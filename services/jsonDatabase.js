/**
 * JSON Persistence Database Service
 * Provides safe, queued, atomic JSON file read/write operations with corruption recovery.
 */

const fs = require('fs');
const path = require('path');

// Write queues per file path to prevent concurrent write collisions / race conditions
const fileLocks = new Map();

/**
 * Ensures a directory exists
 * @param {string} dirPath 
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Execute an operation in a sequential per-file queue
 * @param {string} filePath 
 * @param {Function} taskFn 
 * @returns {Promise<any>}
 */
async function enqueueFileTask(filePath, taskFn) {
  const normalizedPath = path.resolve(filePath);
  const currentPromise = fileLocks.get(normalizedPath) || Promise.resolve();

  const nextPromise = currentPromise.then(async () => {
    try {
      return await taskFn();
    } catch (err) {
      throw err;
    }
  }).catch((err) => {
    // Keep chain alive for subsequent operations
    console.error(`[DB Error in file ${path.basename(filePath)}]:`, err.message);
    throw err;
  });

  fileLocks.set(normalizedPath, nextPromise);
  return nextPromise;
}

/**
 * Reads and parses a JSON file safely.
 * If corrupted, moves corrupt file to a timestamped backup and returns defaultVal.
 * @param {string} filePath 
 * @param {any} defaultVal 
 * @returns {Promise<any>}
 */
async function readData(filePath, defaultVal = []) {
  const normalizedPath = path.resolve(filePath);
  ensureDirSync(path.dirname(normalizedPath));

  if (!fs.existsSync(normalizedPath)) {
    await writeData(normalizedPath, defaultVal);
    return defaultVal;
  }

  try {
    const rawContent = await fs.promises.readFile(normalizedPath, 'utf8');
    if (!rawContent || rawContent.trim() === '') {
      return defaultVal;
    }
    return JSON.parse(rawContent);
  } catch (parseError) {
    console.error(`[CRITICAL] JSON corruption detected in ${path.basename(normalizedPath)}:`, parseError.message);
    
    // Backup the corrupt file
    const backupPath = `${normalizedPath}.corrupt_${Date.now()}.bak`;
    try {
      if (fs.existsSync(normalizedPath)) {
        await fs.promises.copyFile(normalizedPath, backupPath);
        console.warn(`[RECOVERY] Corrupt file safely backed up to ${path.basename(backupPath)}`);
      }
    } catch (backupErr) {
      console.error('[ERROR] Failed to create corrupt file backup:', backupErr.message);
    }

    // Reinitialize with default safe structure
    await writeData(normalizedPath, defaultVal);
    return defaultVal;
  }
}

/**
 * Safely writes content to file using atomic rename with Windows fallback
 * @param {string} normalizedPath 
 * @param {string} jsonString 
 */
async function safeAtomicWrite(normalizedPath, jsonString) {
  const tmpPath = `${normalizedPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  try {
    await fs.promises.writeFile(tmpPath, jsonString, 'utf8');
    try {
      await fs.promises.rename(tmpPath, normalizedPath);
    } catch (renameErr) {
      // On Windows, rapid renames can throw EPERM/EBUSY if file handle is momentarily held
      if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY' || renameErr.code === 'EACCES') {
        await fs.promises.writeFile(normalizedPath, jsonString, 'utf8');
        try { await fs.promises.unlink(tmpPath); } catch (_) {}
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try { await fs.promises.unlink(tmpPath); } catch (_) {}
    }
    throw err;
  }
}

/**
 * Writes data atomically to a file using temporary file swap.
 * @param {string} filePath 
 * @param {any} data 
 * @returns {Promise<boolean>}
 */
async function writeData(filePath, data) {
  const normalizedPath = path.resolve(filePath);
  ensureDirSync(path.dirname(normalizedPath));

  return enqueueFileTask(normalizedPath, async () => {
    const jsonString = JSON.stringify(data, null, 2);
    await safeAtomicWrite(normalizedPath, jsonString);
    return true;
  });
}

/**
 * Appends a record to a JSON array file with optional max size rotation (FIFO).
 * @param {string} filePath 
 * @param {object} record 
 * @param {number} maxLimit - If specified, keeps only latest `maxLimit` records
 * @returns {Promise<object>} Appended record
 */
async function appendRecord(filePath, record, maxLimit = 0) {
  const normalizedPath = path.resolve(filePath);
  ensureDirSync(path.dirname(normalizedPath));
  
  return enqueueFileTask(normalizedPath, async () => {
    let list = [];
    try {
      if (fs.existsSync(normalizedPath)) {
        const raw = await fs.promises.readFile(normalizedPath, 'utf8');
        list = raw.trim() ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
      }
    } catch (err) {
      list = [];
    }

    list.push(record);

    // Apply FIFO rotation if over limit
    if (maxLimit > 0 && list.length > maxLimit) {
      list = list.slice(list.length - maxLimit);
    }

    await safeAtomicWrite(normalizedPath, JSON.stringify(list, null, 2));
    return record;
  });
}

/**
 * Updates matching records in a JSON array file.
 * @param {string} filePath 
 * @param {Function} predicate - (item) => boolean
 * @param {Function|object} updater - (item) => updatedItem or object to merge
 * @returns {Promise<{ updatedCount: number }>}
 */
async function updateRecord(filePath, predicate, updater) {
  const normalizedPath = path.resolve(filePath);
  ensureDirSync(path.dirname(normalizedPath));

  return enqueueFileTask(normalizedPath, async () => {
    let list = [];
    try {
      if (fs.existsSync(normalizedPath)) {
        const raw = await fs.promises.readFile(normalizedPath, 'utf8');
        list = raw.trim() ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
      }
    } catch (err) {
      list = [];
    }

    let updatedCount = 0;
    list = list.map(item => {
      if (predicate(item)) {
        updatedCount++;
        if (typeof updater === 'function') {
          return updater(item);
        } else {
          return { ...item, ...updater };
        }
      }
      return item;
    });

    if (updatedCount > 0) {
      await safeAtomicWrite(normalizedPath, JSON.stringify(list, null, 2));
    }

    return { updatedCount };
  });
}

/**
 * Searches and filters records from a JSON array file.
 * @param {string} filePath 
 * @param {Function} predicate 
 * @param {number} limit 
 * @param {number} offset 
 * @param {'desc'|'asc'} sortOrder 
 * @returns {Promise<{ total: number, results: any[] }>}
 */
async function findRecords(filePath, predicate = null, limit = 50, offset = 0, sortOrder = 'desc') {
  const data = await readData(filePath, []);
  if (!Array.isArray(data)) {
    return { total: 0, results: [] };
  }

  let filtered = predicate ? data.filter(predicate) : [...data];

  if (sortOrder === 'desc') {
    filtered.reverse();
  }

  const total = filtered.length;
  const results = filtered.slice(offset, offset + limit);

  return { total, results };
}

/**
 * Initialize all database files if they do not exist
 * @param {object} config 
 */
async function initializeDatabase(config) {
  ensureDirSync(config.dataDir);

  if (!fs.existsSync(config.logsFile)) {
    await writeData(config.logsFile, []);
  }

  if (!fs.existsSync(config.blocksFile)) {
    await writeData(config.blocksFile, []);
  }

  if (!fs.existsSync(config.statsFile)) {
    await writeData(config.statsFile, {
      totalRequests: 0,
      totalViolations: 0,
      totalBlocks: 0,
      ipActivity: {},
      endpointHits: {},
      statusCodeHits: {},
      lastUpdated: new Date().toISOString()
    });
  }

  if (!fs.existsSync(config.configFile)) {
    await writeData(config.configFile, {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      violationThreshold: config.violationThreshold,
      blockDurationMs: config.blockDurationMs,
      trustProxy: config.trustProxy
    });
  }
}

module.exports = {
  readData,
  writeData,
  appendRecord,
  updateRecord,
  findRecords,
  initializeDatabase,
  ensureDirSync
};

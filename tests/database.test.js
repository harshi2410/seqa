/**
 * JSON Persistence Database Service Tests
 */

const fs = require('fs');
const path = require('path');
const jsonDb = require('../services/jsonDatabase');

const TEST_DIR = path.join(__dirname, 'temp_test_data');
const TEST_FILE = path.join(TEST_DIR, 'test_db.json');

describe('JSON Database Service', () => {
  beforeAll(() => {
    jsonDb.ensureDirSync(TEST_DIR);
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(TEST_DIR)) {
        await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  beforeEach(async () => {
    try {
      if (fs.existsSync(TEST_FILE)) {
        await fs.promises.unlink(TEST_FILE);
      }
    } catch (_) {
      try {
        await fs.promises.writeFile(TEST_FILE, '[]', 'utf8');
      } catch (_) {}
    }
  });

  test('should create and write data to a new JSON file', async () => {
    const data = [{ id: 1, name: 'Alice' }];
    await jsonDb.writeData(TEST_FILE, data);

    const read = await jsonDb.readData(TEST_FILE);
    expect(read).toEqual(data);
  });

  test('should safely append records and respect max limit rotation', async () => {
    await jsonDb.writeData(TEST_FILE, []);
    
    // Append 5 items with max limit of 3
    for (let i = 1; i <= 5; i++) {
      await jsonDb.appendRecord(TEST_FILE, { id: i, value: `val-${i}` }, 3);
    }

    const read = await jsonDb.readData(TEST_FILE);
    expect(read.length).toBe(3);
    expect(read[0].id).toBe(3);
    expect(read[1].id).toBe(4);
    expect(read[2].id).toBe(5);
  });

  test('should update existing records matching predicate', async () => {
    await jsonDb.writeData(TEST_FILE, [
      { id: 1, status: 'ACTIVE' },
      { id: 2, status: 'ACTIVE' }
    ]);

    const result = await jsonDb.updateRecord(
      TEST_FILE,
      (item) => item.id === 1,
      (item) => ({ ...item, status: 'EXPIRED' })
    );

    expect(result.updatedCount).toBe(1);

    const read = await jsonDb.readData(TEST_FILE);
    expect(read.find(i => i.id === 1).status).toBe('EXPIRED');
    expect(read.find(i => i.id === 2).status).toBe('ACTIVE');
  });

  test('should handle corrupted JSON safely without crashing and restore backup', async () => {
    // Write invalid JSON string
    await fs.promises.writeFile(TEST_FILE, '{ "invalidJson": [corrupt-data', 'utf8');

    // Attempt to read - should not throw, should return safe fallback
    const result = await jsonDb.readData(TEST_FILE, []);
    expect(result).toEqual([]);

    // Verify backup file was created
    const files = await fs.promises.readdir(TEST_DIR);
    const backupExists = files.some(f => f.includes('corrupt') && f.endsWith('.bak'));
    expect(backupExists).toBe(true);
  });

  test('should query records with predicate, pagination, and sorting', async () => {
    const items = [
      { id: 1, type: 'A', val: 10 },
      { id: 2, type: 'B', val: 20 },
      { id: 3, type: 'A', val: 30 },
      { id: 4, type: 'A', val: 40 }
    ];
    await jsonDb.writeData(TEST_FILE, items);

    const query = await jsonDb.findRecords(
      TEST_FILE,
      (item) => item.type === 'A',
      2, // limit
      0, // offset
      'desc' // sort
    );

    expect(query.total).toBe(3);
    expect(query.results.length).toBe(2);
    expect(query.results[0].id).toBe(4);
    expect(query.results[1].id).toBe(3);
  });
});

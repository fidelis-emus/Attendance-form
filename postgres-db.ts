import pg from "pg";
import fs from "fs";
import path from "path";
import { ObjectId } from "mongodb";

const { Pool } = pg;

// Helper to generate dynamic structured unique IDs
export function generateId(): string {
  return new ObjectId().toHexString();
}

// Global postgres pool instance
let pool: pg.Pool | null = null;
let postgresDbInstance: PostgresDatabase | null = null;

// Helpers to match MongoDB-style queries in memory (matches local collection behaviors)
function matchQuery(item: any, query: any): boolean {
  if (!query || Object.keys(query).length === 0) return true;
  for (const key of Object.keys(query)) {
    const queryVal = query[key];
    if (queryVal === undefined) continue;
    
    const itemVal = item[key];
    
    if (queryVal && typeof queryVal === "object" && !Array.isArray(queryVal) && !(queryVal instanceof Date)) {
      for (const op of Object.keys(queryVal)) {
        if (op === "$gte") {
          if (!(itemVal >= queryVal[op])) return false;
        } else if (op === "$gt") {
          if (!(itemVal > queryVal[op])) return false;
        } else if (op === "$lte") {
          if (!(itemVal <= queryVal[op])) return false;
        } else if (op === "$lt") {
          if (!(itemVal < queryVal[op])) return false;
        } else if (op === "$ne") {
          if (itemVal === queryVal[op]) return false;
        } else if (op === "$in") {
          if (!Array.isArray(queryVal[op]) || !queryVal[op].includes(itemVal)) return false;
        } else {
          if (itemVal !== queryVal) return false;
        }
      }
    } else {
      if (itemVal !== queryVal) return false;
    }
  }
  return true;
}

function sortItems(items: any[], sortQuery: any): any[] {
  if (!sortQuery) return items;
  const key = Object.keys(sortQuery)[0];
  const direction = sortQuery[key]; // -1 for desc, 1 for asc
  return [...items].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (valA === undefined) return 1;
    if (valB === undefined) return -1;
    if (valA < valB) return direction === -1 ? 1 : -1;
    if (valA > valB) return direction === -1 ? -1 : 1;
    return 0;
  });
}

// Cursor-like wrapper for synchronous .find() calls matching MongoDB behaviors
export class PostgresCursor {
  private sortQuery: any = null;

  constructor(
    private tableName: string,
    private pgPool: pg.Pool,
    private query: any,
    private options: any
  ) {}

  sort(sortQuery: any) {
    this.sortQuery = sortQuery;
    return this;
  }

  async toArray(): Promise<any[]> {
    let selectQuery = `SELECT data FROM "${this.tableName}"`;
    let values: any[] = [];
    
    if (this.query && this.query.id && typeof this.query.id === "string") {
      selectQuery += ` WHERE id = $1`;
      values.push(this.query.id);
    } else if (this.query && this.query._id && typeof this.query._id === "string") {
      selectQuery += ` WHERE id = $1`;
      values.push(this.query._id);
    } else if (this.query && this.query.email && typeof this.query.email === "string") {
      selectQuery += ` WHERE data->>'email' = $1`;
      values.push(this.query.email);
    } else if (this.query && this.query.date && typeof this.query.date === "string") {
      selectQuery += ` WHERE data->>'date' = $1`;
      values.push(this.query.date);
    }

    try {
      const res = await this.pgPool.query(selectQuery, values);
      let items = res.rows.map(row => row.data);
      
      items = items.filter(item => matchQuery(item, this.query));
      if (this.sortQuery) {
        items = sortItems(items, this.sortQuery);
      }
      return items;
    } catch (err) {
      console.error(`PostgreSQL Cursor error in ${this.tableName}:`, err);
      throw err;
    }
  }
}

// PostgreSQL dynamic collection adapter
export class PostgresCollection {
  constructor(public tableName: string, private pgPool: pg.Pool) {}

  find(query: any = {}, options: any = {}) {
    return new PostgresCursor(this.tableName, this.pgPool, query, options);
  }

  async findOne(query: any, options: any = {}) {
    let selectQuery = `SELECT data FROM "${this.tableName}"`;
    let values: any[] = [];
    
    if (query && query.id && typeof query.id === "string") {
      selectQuery += ` WHERE id = $1`;
      values.push(query.id);
    } else if (query && query._id && typeof query._id === "string") {
      selectQuery += ` WHERE id = $1`;
      values.push(query._id);
    } else if (query && query.email && typeof query.email === "string") {
      selectQuery += ` WHERE data->>'email' = $1`;
      values.push(query.email);
    }

    try {
      const res = await this.pgPool.query(selectQuery, values);
      const items = res.rows.map(row => row.data);
      const matched = items.find(item => matchQuery(item, query));
      return matched || null;
    } catch (err) {
      console.error(`PostgreSQL Error findOne in ${this.tableName}:`, err);
      throw err;
    }
  }

  async insertOne(doc: any) {
    const id = doc.id || doc._id || generateId();
    const newDoc = { ...doc, id, _id: id };
    try {
      await this.pgPool.query(
        `INSERT INTO "${this.tableName}" (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
        [id, JSON.stringify(newDoc)]
      );
      return { acknowledged: true, insertedId: id };
    } catch (err) {
      console.error(`PostgreSQL Error insertOne in ${this.tableName}:`, err);
      throw err;
    }
  }

  async insertMany(docs: any[]) {
    try {
      const addedDocs = docs.map(doc => {
        const id = doc.id || doc._id || generateId();
        return { ...doc, id, _id: id };
      });
      
      await this.pgPool.query("BEGIN");
      for (const doc of addedDocs) {
        await this.pgPool.query(
          `INSERT INTO "${this.tableName}" (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
          [doc.id, JSON.stringify(doc)]
        );
      }
      await this.pgPool.query("COMMIT");
      return { acknowledged: true, insertedCount: addedDocs.length };
    } catch (err) {
      await this.pgPool.query("ROLLBACK");
      console.error(`PostgreSQL Error insertMany in ${this.tableName}:`, err);
      throw err;
    }
  }

  async updateOne(query: any, update: any, options: any = {}) {
    try {
      const doc = await this.findOne(query);
      if (doc) {
        const setObj = update.$set || {};
        const updatedDoc = { ...doc };
        for (const key of Object.keys(setObj)) {
          updatedDoc[key] = setObj[key];
        }
        await this.pgPool.query(
          `UPDATE "${this.tableName}" SET data = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedDoc), updatedDoc.id]
        );
        return { acknowledged: true, modifiedCount: 1 };
      } else if (options.upsert) {
        const id = query.id || generateId();
        const newDoc = { ...query, id, _id: id };
        const setObj = update.$set || {};
        for (const key of Object.keys(setObj)) {
          newDoc[key] = setObj[key];
        }
        await this.pgPool.query(
          `INSERT INTO "${this.tableName}" (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
          [id, JSON.stringify(newDoc)]
        );
        return { acknowledged: true, modifiedCount: 1 };
      }
      return { acknowledged: true, modifiedCount: 0 };
    } catch (err) {
      console.error(`PostgreSQL Error updateOne in ${this.tableName}:`, err);
      throw err;
    }
  }

  async updateMany(query: any, update: any, options: any = {}) {
    try {
      const res = await this.pgPool.query(`SELECT data FROM "${this.tableName}"`);
      const items = res.rows.map(row => row.data);
      const matched = items.filter(item => matchQuery(item, query));
      
      if (matched.length > 0) {
        await this.pgPool.query("BEGIN");
        for (const doc of matched) {
          const setObj = update.$set || {};
          const updatedDoc = { ...doc };
          for (const key of Object.keys(setObj)) {
            updatedDoc[key] = setObj[key];
          }
          await this.pgPool.query(
            `UPDATE "${this.tableName}" SET data = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedDoc), updatedDoc.id]
          );
        }
        await this.pgPool.query("COMMIT");
        return { acknowledged: true, modifiedCount: matched.length };
      }
      return { acknowledged: true, modifiedCount: 0 };
    } catch (err) {
      await this.pgPool.query("ROLLBACK");
      console.error(`PostgreSQL Error updateMany in ${this.tableName}:`, err);
      throw err;
    }
  }

  async deleteOne(query: any) {
    try {
      const doc = await this.findOne(query);
      if (doc) {
        await this.pgPool.query(`DELETE FROM "${this.tableName}" WHERE id = $1`, [doc.id]);
        return { acknowledged: true, deletedCount: 1 };
      }
      return { acknowledged: true, deletedCount: 0 };
    } catch (err) {
      console.error(`PostgreSQL Error deleteOne in ${this.tableName}:`, err);
      throw err;
    }
  }

  async deleteMany(query: any) {
    try {
      const res = await this.pgPool.query(`SELECT data FROM "${this.tableName}"`);
      const items = res.rows.map(row => row.data);
      const matched = items.filter(item => matchQuery(item, query));
      
      if (matched.length > 0) {
        await this.pgPool.query("BEGIN");
        for (const doc of matched) {
          await this.pgPool.query(`DELETE FROM "${this.tableName}" WHERE id = $1`, [doc.id]);
        }
        await this.pgPool.query("COMMIT");
        return { acknowledged: true, deletedCount: matched.length };
      }
      return { acknowledged: true, deletedCount: 0 };
    } catch (err) {
      await this.pgPool.query("ROLLBACK");
      console.error(`PostgreSQL Error deleteMany in ${this.tableName}:`, err);
      throw err;
    }
  }

  async countDocuments(query: any = {}) {
    try {
      const res = await this.pgPool.query(`SELECT data FROM "${this.tableName}"`);
      const items = res.rows.map(row => row.data);
      const matched = items.filter(item => matchQuery(item, query));
      return matched.length;
    } catch (err) {
      console.error(`PostgreSQL Error countDocuments in ${this.tableName}:`, err);
      throw err;
    }
  }
}

export class PostgresDatabase {
  constructor(public pool: pg.Pool) {}

  collection(name: string) {
    return new PostgresCollection(name, this.pool);
  }
}

// Local Database mock engine for robust local dev sandboxing when DB is offline
class LocalCollection {
  constructor(private name: string, private db: LocalDatabase) {}

  find(query: any = {}, options: any = {}) {
    const getFiltered = async () => {
      const items = await this.db.readCollection(this.name);
      return items.filter(item => matchQuery(item, query));
    };
    return {
      sort: (sortQuery: any) => {
        return {
          toArray: async () => {
            const filtered = await getFiltered();
            return sortItems(filtered, sortQuery);
          }
        };
      },
      toArray: async () => {
        return await getFiltered();
      }
    };
  }

  async findOne(query: any) {
    const items = await this.db.readCollection(this.name);
    const item = items.find(item => matchQuery(item, query));
    return item || null;
  }

  async insertOne(doc: any) {
    const items = await this.db.readCollection(this.name);
    const id = doc.id || doc._id || generateId();
    const newDoc = { ...doc, id, _id: id };
    items.push(newDoc);
    await this.db.writeCollection(this.name, items);
    return { acknowledged: true, insertedId: id };
  }

  async insertMany(docs: any[]) {
    const items = await this.db.readCollection(this.name);
    const addedDocs = docs.map(doc => {
      const id = doc.id || doc._id || generateId();
      return { ...doc, id, _id: id };
    });
    items.push(...addedDocs);
    await this.db.writeCollection(this.name, items);
    return { acknowledged: true, insertedCount: addedDocs.length };
  }

  async updateOne(query: any, update: any, options: any = {}) {
    const items = await this.db.readCollection(this.name);
    let updated = false;
    for (let item of items) {
      if (matchQuery(item, query)) {
        const setObj = update.$set || {};
        for (const key of Object.keys(setObj)) {
          item[key] = setObj[key];
        }
        updated = true;
      }
    }
    if (!updated && options.upsert) {
      const id = query.id || generateId();
      const newDoc = { ...query, id, _id: id };
      const setObj = update.$set || {};
      for (const key of Object.keys(setObj)) {
        newDoc[key] = setObj[key];
      }
      items.push(newDoc);
      updated = true;
    }
    if (updated) {
      await this.db.writeCollection(this.name, items);
    }
    return { acknowledged: true, modifiedCount: updated ? 1 : 0 };
  }

  async updateMany(query: any, update: any, options: any = {}) {
    const items = await this.db.readCollection(this.name);
    let count = 0;
    for (let item of items) {
      if (matchQuery(item, query)) {
        const setObj = update.$set || {};
        for (const key of Object.keys(setObj)) {
          item[key] = setObj[key];
        }
        count++;
      }
    }
    if (count > 0) {
      await this.db.writeCollection(this.name, items);
    }
    return { acknowledged: true, modifiedCount: count };
  }

  async deleteOne(query: any) {
    const items = await this.db.readCollection(this.name);
    const index = items.findIndex(item => matchQuery(item, query));
    if (index !== -1) {
      items.splice(index, 1);
      await this.db.writeCollection(this.name, items);
      return { acknowledged: true, deletedCount: 1 };
    }
    return { acknowledged: true, deletedCount: 0 };
  }

  async deleteMany(query: any) {
    const items = await this.db.readCollection(this.name);
    const initialLen = items.length;
    const filtered = items.filter(item => !matchQuery(item, query));
    if (filtered.length !== initialLen) {
      await this.db.writeCollection(this.name, filtered);
    }
    return { acknowledged: true, deletedCount: initialLen - filtered.length };
  }

  async countDocuments(query: any = {}) {
    const items = await this.db.readCollection(this.name);
    const filtered = items.filter(item => matchQuery(item, query));
    return filtered.length;
  }
}

class LocalDatabase {
  private dataDir = path.join(process.cwd(), "local_db");

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  collection(name: string) {
    return new LocalCollection(name, this);
  }

  async readCollection(name: string): Promise<any[]> {
    const filePath = path.join(this.dataDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  }

  async writeCollection(name: string, data: any[]): Promise<void> {
    const filePath = path.join(this.dataDir, `${name}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error(`Error writing collection ${name}:`, err);
    }
  }
}

// Lazy Pool Initializer with robust fallbacks
export async function getDb(): Promise<any> {
  if (postgresDbInstance) {
    return postgresDbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.DB_HOST || process.env.SQL_HOST;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  const database = process.env.DB_NAME || process.env.SQL_DB_NAME;
  const user = process.env.DB_USER || process.env.SQL_USER;
  const password = process.env.DB_PASSWORD || process.env.SQL_PASSWORD;

  const hasPgEnv = !!(databaseUrl || (host && database && user));

  if (!hasPgEnv) {
    console.warn("⚠️ PostgreSQL Environment Variables not fully specified. Falling back to robust Local File Database storage to preserve full application function offline!");
    return new LocalDatabase();
  }

  console.log("Connecting to production-grade PostgreSQL database...");
  try {
    const config: pg.PoolConfig = databaseUrl
      ? { connectionString: databaseUrl }
      : { host, port, database, user, password };

    // Connection pooling setup
    pool = new Pool({
      ...config,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL pool client:", err);
    });

    // Test query to guarantee postgres connection
    await pool.query("SELECT NOW()");
    console.log("Successfully connected to production PostgreSQL database!");

    // Bootstrapping the database tables
    await initializePostgres(pool);
    
    // Migrate existing JSON data
    await migrateExistingData(pool);

    postgresDbInstance = new PostgresDatabase(pool);
    return postgresDbInstance;
  } catch (err) {
    console.error("PostgreSQL Connection Failed, fallback to local backup directory:", err);
    return new LocalDatabase();
  }
}

// Automated PostgreSQL Tables Provisioning
async function initializePostgres(pgPool: pg.Pool) {
  const tables = [
    "members", "workers", "attendance", "whatsapp_logs", "admins", 
    "sundays", "quick_replies", "settings", "audit_logs", 
    "scheduler_runs", "message_queue", "baileys_session", "backup_history"
  ];
  
  for (const table of tables) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS "${table}" (
        id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  // GIN Indexes on data JSONB column for extremely fast search & filtering
  for (const table of tables) {
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS "${table}_data_idx" ON "${table}" USING gin (data)
    `);
  }
}

// Self-contained dynamic migration engine
async function migrateExistingData(pgPool: pg.Pool) {
  try {
    const checkResult = await pgPool.query(`
      SELECT id FROM settings WHERE id = 'migration_status'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("PostgreSQL: Migration already marked complete. Skipping.");
      return;
    }
  } catch (err) {
    // If the check fails (e.g. settings table created but has issues), return early to avoid crash
    console.warn("PostgreSQL: Migration check failed, skipping automatic load.");
    return;
  }
  
  console.log("PostgreSQL: Executing one-shot data migration from local JSON files...");
  const dataDir = path.join(process.cwd(), "local_db");
  const files = [
    { file: "sundays.json", table: "sundays" },
    { file: "members.json", table: "members" },
    { file: "workers.json", table: "workers" },
    { file: "attendance.json", table: "attendance" },
    { file: "whatsapp_logs.json", table: "whatsapp_logs" },
    { file: "admins.json", table: "admins" },
    { file: "quick_replies.json", table: "quick_replies" },
    { file: "settings.json", table: "settings" },
    { file: "audit_logs.json", table: "audit_logs" },
    { file: "scheduler_runs.json", table: "scheduler_runs" },
    { file: "message_queue.json", table: "message_queue" },
    { file: "baileys_session.json", table: "baileys_session" }
  ];
  
  for (const item of files) {
    const filePath = path.join(dataDir, item.file);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          console.log(`PostgreSQL: Migrating ${items.length} records into table: "${item.table}"`);
          for (const doc of items) {
            const id = doc.id || doc._id || generateId();
            if (!doc.id) doc.id = id;
            if (!doc._id) doc._id = id;
            await pgPool.query(
              `INSERT INTO "${item.table}" (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
              [id, JSON.stringify(doc)]
            );
          }
        }
      } catch (err) {
        console.error(`PostgreSQL: Failed to migrate file ${item.file}:`, err);
      }
    }
  }
  
  try {
    await pgPool.query(
      `INSERT INTO settings (id, data) VALUES ('migration_status', $1) ON CONFLICT (id) DO UPDATE SET data = $1`,
      [JSON.stringify({ id: "migration_status", completed: true, migratedAt: new Date().toISOString() })]
    );
    console.log("PostgreSQL: Migration executed and locked successfully.");
  } catch (err) {
    console.error("PostgreSQL: Failed to record migration completion flag:", err);
  }
}

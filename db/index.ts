import { db } from "./client";
import { errorMapper } from "./middleware/errorMapper";
import { logger } from "./middleware/logger";
import { retry } from "./middleware/retry";


export async function setupDB() {
    await db.init("app.db");
    db.use(logger);
    db.use(retry(3));
    db.use(errorMapper);
}

export { db };


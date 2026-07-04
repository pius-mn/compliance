import { initDatabase, query } from "./mysql";
import bcrypt from "bcrypt";

const ADMIN_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "admin";
const SALT_ROUNDS = 10;

async function seedAdmin() {
  await initDatabase();

  // Check if any users exist
  const existing = await query("SELECT id FROM users LIMIT 1") as { id: number }[];
  if (existing.length > 0) {
    console.log("Users already exist in the database. Skipping admin seed.");
    process.exit(0);
  }

  console.log("No users found — seeding admin user...");

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  await query(
    `INSERT INTO users (name, email, role, isCentral, username, password)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "Administrator",
      "admin@ehs-portal.com",
      "Safaricom Admin",
      true,
      "admin",
      hashedPassword,
    ]
  );

  console.log("✅ Admin user created:");
  console.log("   Email:    admin@ehs-portal.com");
  console.log("   Password: admin");
  console.log("Database seeding complete.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

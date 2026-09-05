const { initializeApp, cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const keyPath =
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(keyPath)) {
  console.error("Service account key not found.");
  console.error(`Expected at: ${keyPath}`);
  console.error(
    "Download it from Firebase console -> Project settings -> Service accounts -> Generate new private key.",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });

const databaseUrl =
  process.env.FIREBASE_DATABASE_URL ||
  `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;
const db = getDatabase(databaseUrl);

const isBcryptHash = (v) =>
  typeof v === "string" && /^\$2[aby]\$/.test(v);
const hashPassword = (plain) => bcrypt.hashSync(String(plain), 10);

async function main() {
  const summary = {
    adminsHashed: 0,
    adminsSkipped: 0,
    seededSuperAdmin: false,
    stationsCleaned: 0,
    stationsSkipped: 0,
  };

  const adminSnap = await db.ref("admins").once("value");
  const admins = adminSnap.val();

  if (!admins || Object.keys(admins).length === 0) {
    const seedEmail = "admin@aquallera.com";
    const seedPassword = "admin123";
    await db.ref("admins").push({
      email: seedEmail,
      password: hashPassword(seedPassword),
      invitedBy: "system",
      createdAt: new Date().toISOString(),
    });
    summary.seededSuperAdmin = true;
    console.log(`Seeded super admin: ${seedEmail} (password: ${seedPassword})`);
    console.log(
      "IMPORTANT: Log in and change this password immediately via the Change Password modal.",
    );
  } else {
    for (const [key, admin] of Object.entries(admins)) {
      if (
        admin &&
        typeof admin.password === "string" &&
        !isBcryptHash(admin.password)
      ) {
        await db
          .ref(`admins/${key}`)
          .update({ password: hashPassword(admin.password) });
        summary.adminsHashed++;
      } else {
        summary.adminsSkipped++;
      }
    }
  }

  const stationsSnap = await db.ref("waterStations").once("value");
  const stations = stationsSnap.val();
  if (stations) {
    for (const [key, station] of Object.entries(stations)) {
      if (
        station &&
        Object.prototype.hasOwnProperty.call(station, "password")
      ) {
        await db.ref(`waterStations/${key}`).update({ password: null });
        summary.stationsCleaned++;
      } else {
        summary.stationsSkipped++;
      }
    }
  }

  console.log("\nMigration summary:");
  console.log(`  Admins hashed:    ${summary.adminsHashed}`);
  console.log(`  Admins skipped:   ${summary.adminsSkipped}`);
  if (summary.seededSuperAdmin) {
    console.log("  Super admin:      seeded");
  }
  console.log(`  Stations cleaned: ${summary.stationsCleaned}`);
  console.log(`  Stations skipped: ${summary.stationsSkipped}`);
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
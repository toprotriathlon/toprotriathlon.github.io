// One-off developer utility — NOT part of the site's runtime, NOT loaded by
// any HTML page. Writes scripts/seed/swim-camp.json into Firestore as
// pages/swim-camp so the admin app has real content to render/edit against,
// instead of hand-typing a ~30-block nested document into the Firestore
// console UI.
//
// Setup (one-time):
//   1. Firebase Console → Project settings → Service accounts →
//      "Generate new private key" → save the downloaded file as
//      scripts/service-account.json (already gitignored-equivalent: this
//      repo has no .gitignore yet, so DO NOT commit that file — it's a
//      private credential, not a public client config like firebase-config.js)
//   2. npm install firebase-admin   (run once, inside scripts/ or repo root —
//      this is the one place in the project that touches npm, and only as a
//      local dev tool; it does not affect the site's zero-build-step deploy)
//
// Run:
//   node scripts/seed-swim-camp.mjs
//
// Safe to re-run: it overwrites pages/swim-camp's draftVersion (and leaves
// publishedVersion alone unless the doc doesn't exist yet), so re-running
// after editing swim-camp.json just refreshes the draft for another look in
// the admin app — it will NOT undo anything you've already published.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, "service-account.json");
const seedPath = join(__dirname, "seed", "swim-camp.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
} catch {
  console.error(
    `\nCouldn't read ${serviceAccountPath}.\n` +
    `Download a service account key from Firebase Console → Project settings →\n` +
    `Service accounts → "Generate new private key", save it at that exact path, and re-run.\n`
  );
  process.exit(1);
}

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
delete seed._comment; // annotation only, not part of the stored document

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const { slug, title, metaDescription, status, header, blocks } = seed;
const now = Timestamp.now();

const existing = await db.collection("pages").doc(slug).get();

await db.collection("pages").doc(slug).set(
  {
    slug,
    title,
    metaDescription,
    status: existing.exists ? existing.data().status : status,
    draftVersion: { header, blocks, updatedAt: now },
    publishedVersion: existing.exists ? existing.data().publishedVersion ?? null : null,
    createdAt: existing.exists ? existing.data().createdAt : now,
    updatedAt: now,
    createdBy: existing.exists ? existing.data().createdBy : "seed-script",
    updatedBy: "seed-script",
  },
  { merge: false }
);

console.log(
  existing.exists
    ? `Updated draftVersion for pages/${slug} (publishedVersion left untouched).`
    : `Created pages/${slug} with a draft (not yet published).`
);

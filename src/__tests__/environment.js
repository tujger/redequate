// Admin SDK imports require a database URL even when tests stub all I/O.
process.env.GCLOUD_PROJECT ??= "demo-redequate-unit";
process.env.FIREBASE_CONFIG ??= JSON.stringify({
    projectId: process.env.GCLOUD_PROJECT,
    databaseURL: `https://${process.env.GCLOUD_PROJECT}-default-rtdb.firebaseio.com`,
    storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com`
});

---
title: Migrate content between different Sanity projects
description: Different approaches to migrate content between different Sanity projects.
pubDate: 2025-08-15
author: Google Gemini
aiGeneratedContent: true
tags:
  - sanity
  - cms
  - migration
---

## Migrate a single document between different Sanity projects

The most reliable way to migrate a single document between different Sanity projects is by using a Node.js script with the `@sanity/client` library. This approach correctly handles authentication for both projects.

A manual CLI approach is also possible for a quick one-off task but is more cumbersome.

---

### Recommended Method: Node.js Script 🚀

This method gives you the most control, is repeatable, and is best for handling any data transformations if needed.

#### **Prerequisites**

1.  **Node.js and npm:** Make sure you have Node.js installed on your machine.
2.  **Project Details:** You'll need the **Project ID** and **Dataset Name** for both the source and destination projects.
3.  **API Tokens:** Create an API token for _each_ project.
    - **Source Project Token:** Needs **Read** permissions.
    - **Destination Project Token:** Needs **Read + Write** permissions.
    - You can create tokens from your project management dashboard at `manage.sanity.io` -> Project -> API -> Tokens -> Add API Token.

#### **Step-by-Step Guide**

1.  **Set up a new project folder:**
    On your computer, create a new folder for the script, navigate into it, and initialize a Node.js project.

    ```bash
    mkdir sanity-migrator
    cd sanity-migrator
    npm init -y
    ```

2.  **Install the Sanity client:**

    ```bash
    npm install @sanity/client
    ```

3.  **Create the migration script:**
    Create a file named `migrate.js` and paste the following code into it. **Remember to replace the placeholder values** with your actual project details.

    ```javascript
    // migrate.js
    import { createClient } from "@sanity/client";

    // --- Configuration ---
    // Replace with your actual project details and document ID
    const SOURCE_CONFIG = {
      projectId: "YOUR_SOURCE_PROJECT_ID",
      dataset: "production", // Or your source dataset name
      token: "YOUR_SOURCE_READ_TOKEN",
      apiVersion: "2023-08-01",
      useCdn: false, // `false` ensures you get fresh data
    };

    const DESTINATION_CONFIG = {
      projectId: "YOUR_DESTINATION_PROJECT_ID",
      dataset: "staging", // Or your destination dataset name
      token: "YOUR_DESTINATION_WRITE_TOKEN",
      apiVersion: "2023-08-01",
      useCdn: false,
    };

    const DOCUMENT_ID_TO_MIGRATE = "theDocumentIdYouWantToCopy";
    // -------------------

    // Initialize clients for source and destination
    const sourceClient = createClient(SOURCE_CONFIG);
    const destinationClient = createClient(DESTINATION_CONFIG);

    async function migrateDocument() {
      console.log(
        `Fetching document '${DOCUMENT_ID_TO_MIGRATE}' from source...`,
      );

      // 1. Fetch the document from the source project
      const doc = await sourceClient.getDocument(DOCUMENT_ID_TO_MIGRATE);

      if (!doc) {
        console.error("Document not found in the source project. Aborting.");
        return;
      }

      console.log("Document fetched successfully.");

      // 2. Prepare the document for creation in the new project
      // We must remove system-generated fields like _rev, _updatedAt, _createdAt.
      // The _id is kept to maintain the same ID in the destination.
      const { _rev, _updatedAt, _createdAt, ...newDoc } = doc;

      console.log("Preparing to write document to destination...");

      // 3. Create the document in the destination project
      // Using `createOrReplace` will overwrite it if it already exists.
      // Use `create` if you want it to fail if the ID already exists.
      try {
        const result = await destinationClient.createOrReplace(newDoc);
        console.log("✅ Success! Document migrated with new ID:", result._id);
      } catch (error) {
        console.error("❌ Error migrating document:", error.message);
      }
    }

    // Run the migration
    migrateDocument();
    ```

    _Note: To use the `import` syntax, add `"type": "module"` to your `package.json` file._

4.  **Run the script:**
    Open your terminal in the `sanity-migrator` folder and run the script.

    ```bash
    node migrate.js
    ```

---

### Alternative: Manual CLI Method 🔧

This method is feasible for a single document without complex references but involves manual steps.

1.  **Login to the Source Project:**
    In your terminal, make sure your Sanity CLI is logged into the **source project**.

    ```bash
    # Run this and select your source project
    sanity login
    ```

2.  **Get the Document Data:**
    Use the `sanity documents get` command to fetch the document's content and save it to a file.

    ```bash
    sanity documents get <DOCUMENT_ID> > document-to-migrate.json
    ```

3.  **Login to the Destination Project:**
    Now, switch the CLI's context to your **destination project**.

    ```bash
    # Run this again and select your destination project
    sanity login
    ```

4.  **Prepare the JSON file:**
    Open the `document-to-migrate.json` file in a text editor. You **must delete** the following system-managed key-value pairs, as the destination project will generate its own:
    - `"_rev"`
    - `"_createdAt"`
    - `"_updatedAt"`

    Your file should look something like this after editing:

    ```json
    {
      "_id": "theDocumentIdYouWantToCopy",
      "_type": "post",
      "title": "My Blog Post",
      "author": {
        "_ref": "authorId",
        "_type": "reference"
      }
    }
    ```

5.  **Create the Document:**
    Use the `sanity documents create` command to import the cleaned-up JSON file into your destination project.

    ```bash
    sanity documents create --file document-to-migrate.json
    ```

    You should see a "Success" message if the operation was completed.

---

### Important Considerations ⚠️

- **Document References:** If your document contains references to other documents (e.g., an `author` on a `post`), those referenced documents **must exist** in the destination dataset with the **same `_id`s** for the references to work. If they don't, the references will be broken.
- **Assets (Images and Files):** Asset references (`image.asset._ref`) will be copied as-is. However, the actual binary asset data belongs to the source project's dataset. The image will still render, but it's "hotlinked" from the old project. For a true migration, you would need a more advanced script to download the asset from the source and re-upload it to the destination project to get a new asset record.
- **API Tokens:** Always store your API tokens securely. For the script method, using environment variables (with a library like `dotenv`) is much safer than hardcoding them directly in the script.

---

## Migrate multiple documents in a bulk between different Sanity projects

To migrate all documents of a specific type in bulk, you can choose between two primary methods: using the Sanity CLI for a simple transfer, or an enhanced Node.js script for more control.

For most bulk migrations, **the Sanity CLI method is the recommended starting point** because it's simpler and optimized for handling large amounts of data.

---

### Method 1: Using the Sanity CLI (Recommended) ⚙️

This is the most straightforward way to perform a bulk migration. The process involves exporting only the document type you need from the source and importing it into the destination.

#### **Step-by-Step Guide**

1.  **Login to Your Source Project**
    In your terminal, make sure your Sanity CLI is configured for the **source project**.

    ```bash
    # Run this and select your SOURCE project
    sanity login
    ```

2.  **Export the Specific Document Type**
    Use the `sanity dataset export` command with the `--types` flag to specify which document type you want. This command will create a compressed `.tar.gz` file.

    ```bash
    # Replace 'yourDocType' with the actual name of your schema type
    # (e.g., 'post', 'product')
    # Replace 'production' with your source dataset name if it's different
    sanity dataset export production --types yourDocType
    ```

    This will generate a file like `production-export-....tar.gz`.

3.  **Login to Your Destination Project**
    Now, switch the CLI's context to your **destination project**. This is a crucial step.

    ```bash
    # Run this again and select your DESTINATION project
    sanity login
    ```

4.  **Import the Data**
    Use the `sanity dataset import` command to upload the exported file to your destination dataset. Using the `--replace` flag will update existing documents that have the same `_id`.

    ```bash
    # Use the actual filename from step 2
    # Replace 'staging' with your destination dataset name
    sanity dataset import production-export-....tar.gz staging --replace
    ```

    The CLI will handle the entire upload process.

---

### Method 2: Modified Node.js Script (For More Control) 📜

This method is ideal if you need to **transform data** during the migration (e.g., change field names, add default values) or handle complex logic. It modifies the previous script to fetch all documents of a type and write them in a single, efficient transaction.

#### **Updated Script**

This script uses a **GROQ query** to fetch the documents and a **transaction** to create them efficiently.

```javascript
// migrate-bulk.js
import { createClient } from "@sanity/client";

// --- Configuration ---
// Replace with your actual project details and document type
const SOURCE_CONFIG = {
  projectId: "YOUR_SOURCE_PROJECT_ID",
  dataset: "production",
  token: "YOUR_SOURCE_READ_TOKEN",
  apiVersion: "2023-08-01",
  useCdn: false,
};

const DESTINATION_CONFIG = {
  projectId: "YOUR_DESTINATION_PROJECT_ID",
  dataset: "staging",
  token: "YOUR_DESTINATION_WRITE_TOKEN",
  apiVersion: "2023-08-01",
  useCdn: false,
};

const DOCUMENT_TYPE_TO_MIGRATE = "yourDocType"; // e.g., 'post'
// -------------------

const sourceClient = createClient(SOURCE_CONFIG);
const destinationClient = createClient(DESTINATION_CONFIG);

async function migrateBulkDocuments() {
  console.log(
    `Fetching all documents of type '${DOCUMENT_TYPE_TO_MIGRATE}'...`,
  );

  // 1. Fetch all documents of the specified type from the source
  const query = `*[_type == "${DOCUMENT_TYPE_TO_MIGRATE}"]`;
  const documents = await sourceClient.fetch(query);

  if (!documents || documents.length === 0) {
    console.log("No documents of that type found. Exiting.");
    return;
  }

  console.log(`Found ${documents.length} documents to migrate.`);

  // 2. Prepare a transaction for the destination project
  let transaction = destinationClient.transaction();

  for (const doc of documents) {
    // 3. Prepare each document for creation, removing system fields
    const { _rev, _updatedAt, _createdAt, ...newDoc } = doc;

    // Here you could add any data transformation logic if needed
    // For example: newDoc.newField = 'some default value';

    // 4. Add the 'createOrReplace' operation to the transaction
    transaction.createOrReplace(newDoc);
  }

  // 5. Commit the transaction to write all documents in one go
  console.log("Writing documents to the destination...");
  try {
    const result = await transaction.commit();
    console.log(`✅ Success! Migrated ${result.results.length} documents.`);
  } catch (error) {
    console.error("❌ Error committing transaction:", error.message);
  }
}

migrateBulkDocuments();
```

To run this script, save it as `migrate-bulk.js` and execute `node migrate-bulk.js`.

---

### Crucial Considerations for Bulk Migration ⚠️

- **References**: This is the most important consideration. If your `yourDocType` documents reference other documents (e.g., a "post" references an "author"), you **must migrate the referenced documents first**. The migration will fail or result in broken links if the referenced documents don't exist in the destination.
- **Assets (Images/Files)**: Both methods will copy the _references_ to assets, not the assets themselves. The images and files will still be hosted by your **source project**. For a true migration, you need a much more complex script that downloads each asset and re-uploads it to the destination project.
- **Drafts**:
  - The **CLI method** (`sanity dataset export`) **does not include drafts by default**. You must add the `--drafts` flag to include them: `sanity dataset export ... --types yourDocType --drafts`.
  - The **Node.js script** using the query `*[_type == "yourDocType"]` will **only fetch published documents**. To include drafts, you'd need a more complex query.
- **Testing**: Always run a migration on a **non-production dataset first**. Create a temporary dataset in your destination project for testing to ensure everything works as expected before running it on your live data.

---
title: Migrate content between different Sanity projects
description: Different approaches to migrate content between different Sanity projects.
pubDate: 2025-08-15
author: Google Gemini
aiGeneratedContent: true
---

## Migrate a single document between different Sanity projects

The most reliable way to migrate a single document between different Sanity projects is by using a Node.js script with the `@sanity/client` library. This approach correctly handles authentication for both projects.

A manual CLI approach is also possible for a quick one-off task but is more cumbersome.

---

### ## Recommended Method: Node.js Script 🚀

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

### ## Alternative: Manual CLI Method 🔧

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

### ## Important Considerations ⚠️

- **Document References:** If your document contains references to other documents (e.g., an `author` on a `post`), those referenced documents **must exist** in the destination dataset with the **same `_id`s** for the references to work. If they don't, the references will be broken.
- **Assets (Images and Files):** Asset references (`image.asset._ref`) will be copied as-is. However, the actual binary asset data belongs to the source project's dataset. The image will still render, but it's "hotlinked" from the old project. For a true migration, you would need a more advanced script to download the asset from the source and re-upload it to the destination project to get a new asset record.
- **API Tokens:** Always store your API tokens securely. For the script method, using environment variables (with a library like `dotenv`) is much safer than hardcoding them directly in the script.

---

## Migrate multiple documents in a bulk between different Sanity projects

To migrate all documents of a specific type in bulk, you can choose between two primary methods: using the Sanity CLI for a simple transfer, or an enhanced Node.js script for more control.

For most bulk migrations, **the Sanity CLI method is the recommended starting point** because it's simpler and optimized for handling large amounts of data.

---

### ## Method 1: Using the Sanity CLI (Recommended) ⚙️

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
    # Replace 'yourDocType' with the actual name of your schema type (e.g., 'post', 'product')
*** Add File: /Users/liangsun/Developer/lyonsun/lyonsun.github.io/src/content/posts/editorconfig-vs-prettier.md
---
title: EditorConfig vs Prettier
description: Do we need both .editorconfig and .prettierrc in a project, or just one of them would be enough?
pubDate: 2025-07-30
author: Google Gemini 2.5 Pro
aiGeneratedContent: true
---

### Decoding Your Dev Environment: .editorconfig vs. .prettierrc

In the world of software development, maintaining consistent code style across a project is crucial for readability and collaboration. Two popular tools that help enforce this consistency are `.editorconfig` and `.prettierrc`. While they both contribute to a standardized codebase, they operate at different levels and serve distinct, yet complementary, purposes.

---

### What is `.editorconfig`?

Think of `.editorconfig` as a universal rulebook for your text editor or Integrated Development Environment (IDE). It's a configuration file that dictates fundamental coding style preferences directly within your editor. This ensures that no matter which supported editor a team member uses, the basic formatting of the code they write remains consistent.

**Key Responsibilities of `.editorconfig`:**

- **Indentation Style:** Defines whether to use tabs or spaces for indentation.
- **Indentation and Tab Size:** Specifies the width of an indent.
- **End of Line Characters:** Enforces consistent line endings (`lf`, `crlf`, or `cr`).
- **Character Set:** Sets the file's character encoding (e.g., `utf-8`).
- **Trimming Trailing Whitespace:** Removes unnecessary whitespace at the end of lines.
- **Ensuring a Final Newline:** Guarantees that files end with a newline character.

The primary goal of `.editorconfig` is to prevent common inconsistencies that arise from different editor configurations. It achieves this by directly influencing the editor's behavior as you type.

---

### What is `.prettierrc`?

On the other hand, `.prettierrc` is the configuration file for **Prettier**, an opinionated code formatter. Prettier takes a more active role by automatically reformatting your code to adhere to a predefined set of style rules. It's less about guiding your typing and more about enforcing a consistent look and feel across the entire codebase with a single command or on save.

**Key Responsibilities of `.prettierrc`:**

- **Print Width:** Determines the maximum line length before the code is wrapped.
- **Semicolon Usage:** Specifies whether to include or omit semicolons at the end of statements.
- **Quote Style:** Enforces the use of single or double quotes.
- **Trailing Commas:** Manages the use of trailing commas in arrays and objects.
- **Bracket Spacing:** Controls the spacing inside curly braces.
- And many more language-specific formatting rules.

`.prettierrc` allows for a much more granular and comprehensive set of formatting rules compared to `.editorconfig`.

---

### The Key Differences at a Glance

| Feature           | `.editorconfig`                                             | `.prettierrc`                                           |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| **Purpose**       | Configures the editor's basic coding style settings.        | Configures an automated code formatter to rewrite code. |
| **Scope**         | Basic settings like indentation, line endings, and charset. | A wide range of stylistic rules for code formatting.    |
| **Execution**     | Applies settings directly within the editor as you code.    | Reformats code on demand (e.g., on save, pre-commit).   |
| **"Opinionated"** | Less opinionated; focuses on fundamental consistency.       | Highly opinionated; enforces a consistent style.        |

---

### Working in Harmony: A Collaborative Approach 🤝

The real power comes from using `.editorconfig` and `.prettierrc` **together**. This combination provides a robust and layered approach to code consistency.

Here's the recommended workflow:

1.  **`.editorconfig` as the Foundation:** Use `.editorconfig` to set the most basic and universal coding style rules for your project. This ensures that even before any automated formatting takes place, your editor is configured correctly.

2.  **`.prettierrc` for the Finer Details:** Let `.prettierrc` handle the more complex and opinionated formatting rules. Prettier can even be configured to read your `.editorconfig` file for its basic settings, ensuring a seamless integration. However, it's important to note that any rules explicitly defined in your `.prettierrc` file will override the corresponding settings from `.editorconfig`.

By leveraging both, you create a development environment where your editor provides initial style guidance, and Prettier acts as the ultimate enforcer of a consistent and readable codebase. This two-pronged approach helps to minimize stylistic debates and allows developers to focus on what truly matters: writing quality code.

# Echo Translation App Scripts

This directory contains utility scripts for the Echo Translation App.

## Available Scripts

### migrate-to-env-vars.js

This script helps migrate hardcoded configuration values to environment variables.

#### Usage

```bash
npm run migrate-to-env
```

or

```bash
node scripts/migrate-to-env-vars.js
```

#### What it does

1. Scans configuration files in the `config/` directory for hardcoded values
2. Identifies API keys, regions, and other configuration values
3. Generates a `.env` file with appropriate entries
4. Provides guidance on next steps

#### After running

After running the migration script:

1. Review the generated `.env` file and make any necessary adjustments
2. Run the setup-config.js script to update configuration files:
   ```bash
   npm run setup-config
   ```
3. Test the application to ensure it works with environment variables

## Best Practices for Configuration

- Store sensitive information like API keys in environment variables
- Use the `.env` file for local development
- In production, set environment variables at the system level
- Never commit `.env` files to version control
- Use `.env.example` as a template for required environment variables
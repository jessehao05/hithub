# hithub

GitHub's contribution graph, but for tennis. One hour of tennis counts as one contribution.

## Screenshot
<img width="2256" height="1344" alt="hithub" src="https://github.com/user-attachments/assets/9f2358c5-4027-4f2d-9ae0-e005c8ec2bb8" />

## Why

I wanted to visualize my tennis activity: how often I play, when, and with whom. I also like how GitHub's style.

## Who it's for

Just me. hithub reads from my own Notion database and is set up around my workflow. You're welcome to adapt it for your use, but it isn't built by default as a multi-user app.

## Setup

Requires Node.js.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Notion database with the schema described in [docs/notion-db.md](docs/notion-db.md), and create a Notion integration that has access to it.

3. Create a `.env.local` file in the project root:

   ```bash
   NOTION_TOKEN=your-integration-secret
   NOTION_DATA_SOURCE_ID=your-data-source-id   # the data source ID, not the database ID
   VIEW_PASSWORD=some-password                 # optional; unlocks partners and location at /unlock
   ```

## Running

Start the dev server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build
npm start
```

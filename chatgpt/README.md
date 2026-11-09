# AliasFleet ChatGPT Action & Custom GPT Guide

This directory contains the official OpenAPI 3.1 specification for integrating AliasFleet into **ChatGPT Plus and Team / Enterprise** via Custom GPT Actions.

---

## 60-Second Setup in ChatGPT

1. Go to [chatgpt.com/gpts/editor](https://chatgpt.com/gpts/editor) or click **Explore GPTs → Create**.
2. Under the **Configure** tab:
   - **Name**: `AliasFleet Email Agent`
   - **Description**: `Provision dedicated forwarding addresses, manage privacy aliases, and inspect your email infrastructure.`
   - **Instructions (System Prompt)**:
     ```text
     You are the AliasFleet Email Agent. You help users manage their email privacy aliases and programmable inboxes using the AliasFleet Developer API.
     When the user asks to create an alias, generate a private forwarding address for a website or newsletter, or check their aliases, call the appropriate AliasFleet action.
     Never share raw API keys or sensitive authorization tokens in chat responses.
     ```
3. Scroll down to **Actions** and click **Create new action**.
4. In the **Schema** box, click **Import from URL** or paste the raw contents of [`openapi.json`](./openapi.json).
5. In **Authentication**:
   - Authentication Type: **API Key**
   - Auth Type: **Bearer**
   - Enter the user's AliasFleet Developer API Key (`afp_...`).
6. Set **Privacy Policy URL**:
   `https://www.aliasfleet.com/policies/privacy-policy`
7. Click **Save / Publish** (Only me or Anyone with a link).

---

## Verification Test

Once configured, test in the preview panel:
> *"Create a new privacy alias for my newsletter signup."*

ChatGPT will call `createAlias` on AliasFleet API and return the provisioned address in seconds!

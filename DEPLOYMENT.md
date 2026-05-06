# Deployment Instructions

## Why GitHub Push Might Fail
If you receive the error "Failed to push commit to GitHub", it is usually due to one of the following:

1. **Token Permissions**: The GitHub Personal Access Token (PAT) you provided might only have "Metadata" or "Read" access. To push code, the token needs **"Contents: Write"** permission.
   - Go to your GitHub Settings -> Developer settings -> Personal access tokens.
   - For Fine-grained tokens, find the token and ensure it has **Repository permissions -> Contents: Read and Write**.
2. **Repository Connection**: Ensure the correct repository is connected in the AI Studio Settings.

## How to Deploy to Vercel

### 1. Manual Export (Recommended if Push Fails)
1. Click the **"Settings"** (gear icon) in the bottom left of AI Studio.
2. Select **"Export as ZIP"**.
3. Extract the ZIP and upload it to a new GitHub repository manually.

### 2. Configure Vercel
1. Import your repository into [Vercel](https://vercel.com).
2. Go to **Settings -> Environment Variables**.
3. Add the following variable:
   - **Key**: `VITE_GITHUB_TOKEN`
   - **Value**: `github_pat_...` (Enter your GitHub Token here)
4. Deploy the app.

## Which API is being used?
The AI Assistant is currently configured to use:
- **Primary**: **Gemini 1.5 Flash** (using the `VITE_GEMINI_API_KEY`).
- **Status**: GitHub Models and OpenAI integrations have been removed.

The code is optimized for Gemini 1.5 Flash to ensure high reliability and free-tier compatibility.

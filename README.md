# GoHockey Companion Mobile App

This project is an Expo React Native application used for managing hockey teams and matches. It uses Supabase for authentication and data storage.

## Prerequisites

- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```
2. Create a `.env` file or configure environment variables with your Supabase credentials:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Example `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
```

## Development

Run the Expo development server:
```sh
npm run dev
```

To lint the project:
```sh
npm run lint
```

## Building for Web

```
npm run build:web
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
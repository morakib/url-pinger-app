# URL Pinger App

A React-based URL monitoring application that allows users to track and ping their URLs to check availability and response times.

## Features

- **User Authentication**: Secure login/signup with Supabase Auth
- **URL Management**: Add, view, and delete URLs to monitor
- **Real-time Ping Testing**: Check URL availability and response times
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Database Integration**: Persistent storage with Supabase

## Tech Stack

- **Frontend**: React 18
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Authentication + Database)
- **Build Tool**: Create React App

## Setup Instructions

### 1. Install Dependencies

```bash
cd my-pinger-app
npm install
```

### 2. Configure Supabase

1. Create a new project at [Supabase](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon key
4. Update the `.env` file with your credentials:

```env
REACT_APP_SUPABASE_URL=your_project_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Set up Database Schema

Create a table called `urls` in your Supabase database with the following structure:

```sql
CREATE TABLE urls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_ping TIMESTAMP WITH TIME ZONE,
    response_time INTEGER,
    status TEXT DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see their own URLs
CREATE POLICY "Users can only access their own URLs" 
ON urls FOR ALL 
USING (auth.uid() = user_id);
```

### 4. Run the Application

```bash
npm start
```

The app will be available at `http://localhost:3000`

## Usage

1. **Sign Up/Login**: Create an account or sign in with existing credentials
2. **Add URLs**: Use the form to add URLs you want to monitor
3. **Monitor URLs**: View your URLs in the table with status indicators
4. **Ping URLs**: Click the "Ping" button to test URL availability
5. **Delete URLs**: Remove URLs you no longer need to monitor

## Features Overview

### Authentication
- Email/password authentication via Supabase Auth
- Secure session management
- Automatic login state persistence

### URL Management
- Add URLs with custom names
- View all URLs in a clean table format
- Delete URLs you no longer need

### Ping Testing
- Test URL availability with one click
- Track response times
- Visual status indicators (success/error)
- Last ping timestamp tracking

### UI/UX
- Responsive design works on all devices
- Clean, modern interface
- Loading states and error handling
- Tailwind CSS for consistent styling

## Project Structure

```
my-pinger-app/
├── public/
│   └── index.html             # Main HTML template
├── src/
│   ├── App.js                 # Main application component
│   ├── Auth.js                # Authentication component
│   ├── URLPinger.js           # URL management component
│   ├── index.js               # Application entry point
│   └── index.css              # Global styles with Tailwind
├── .env                       # Environment variables
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # Tailwind configuration
├── postcss.config.js          # PostCSS configuration
└── README.md                  # This file
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Environment Variables

- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## License

This project is licensed under the MIT License.

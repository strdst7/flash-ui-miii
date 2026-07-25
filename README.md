# Flash UI

Flash UI is a high-fidelity, AI-powered design tool that generates stunning UI components and creative design directions in a flash. Built with a focus on speed and aesthetic precision, it allows designers and developers to rapidly prototype and explore diverse visual concepts using the latest Gemini models.

## ✨ Features

- **Instant Generation**: Transform natural language prompts into production-ready HTML/Tailwind CSS components.
- **Conceptual Variations**: Generate multiple radical design directions for any given prompt to explore the full creative spectrum.
- **Smart Refinement**: Iteratively refine existing components with context-aware variations.
- **Immersive Interface**: A beautiful, fluid UI featuring a dynamic background and an intuitive "Stage" for focusing on specific designs.
- **Export & Share**: Instantly export your creations as ZIP files or share them via unique URLs and QR codes.
- **Surprise Me**: Need inspiration? Use the "Surprise Me" feature to generate creative, random UI component prompts.
- **Dark/Light Mode**: Seamlessly toggle between themes to see how your designs hold up in different environments.

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Express (Node.js) with a custom Vite-integrated server.
- **AI Engine**: Google Gemini API (utilizing `gemini-3.6-flash`, `gemini-flash-latest`, and stable fallbacks).
- **Styling**: Modern Tailwind utility-first approach with custom animations.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd flash-ui
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**:
   Navigate to `http://localhost:3000` in your browser.

## 🏗️ Architecture

- **`server.ts`**: Handles API requests, manages the Gemini API lifecycle (including advanced retry and fallback logic), and serves the static frontend in production.
- **`index.tsx`**: The main application entry point, managing complex state for generations, history, and the immersive UI.
- **`components/`**: Modularized UI components for artifacts, drawers, and overlays.
- **`index.css`**: Global styles and custom Tailwind utilities for the "Sexy Grid" and immersive effects.

## 📝 License

Distributed under the MIT License.

---

*Crafted with ❤️ by Miii*

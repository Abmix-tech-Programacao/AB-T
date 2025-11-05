# Abmix - Sistema de Discagem Inteligente

## Overview
Abmix is an AI-powered telephony system for intelligent voice calls, offering real-time transcription, AI agent control, and advanced call management. It provides a unified interface for outbound calls, AI conversation flow management, live prompt injection, and real-time Portuguese transcription. The system integrates FaleVono as the sole telephony provider via SIP protocol, ElevenLabs for voice synthesis, and Deepgram for speech-to-text, forming a complete conversational AI telephony solution with a modern web application.

The project's ambition is to provide a robust, production-ready solution for intelligent voice interactions, with a focus on seamless deployment and maintainability on platforms like EasyPanel.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The client-side is a React with TypeScript application utilizing modern UI patterns. It employs a component-based design with `shadcn/ui` and `Tailwind CSS` for styling and responsiveness. Dark mode consistency is prioritized.

### Technical Implementations
The system is built as an ESM (ECMAScript Modules) project.
- **Frontend**: React with TypeScript, Zustand for state management, TanStack Query for server state, Wouter for routing, and WebSocket for real-time communication.
- **Backend**: Express.js with TypeScript, providing a REST API and WebSocket support. It features a provider pattern for telephony services and modular service organization.
- **Telephony Integration**: Full SIP protocol implementation for FaleVono with CommonJS module loading (createRequire), including Digest authentication, RFC-compliant dialogs (REGISTER, INVITE, ACK, BYE, CANCEL), and proper network addressing. The system uses port 5000 for web interface and port 6060 for SIP client (configurable via FALEVONO_SIP_PORT). **IMPORTANT**: SIP requires UDP communication which is **blocked in Replit development environment** - production deployment (EasyPanel/VPS) is required for full functionality. TCP fallback available via `SIP_USE_TCP=true`.
- **Data Storage**: SQLite for local persistence of VoIP numbers, calls, recordings, and favorites. Drizzle ORM is configured for PostgreSQL with schema definitions for calls, transcripts, and prompts. Sensitive credentials are stored exclusively in environment variables.
- **Real-time Communication**: WebSocket integration enables bi-directional communication for call state updates, live transcription streaming, AI agent status changes, latency monitoring, and error notifications.

### Feature Specifications
- **Intelligent Voice Calls**: AI-powered conversational flows.
- **Real-time Transcription**: Live Portuguese transcription during calls.
- **AI Agent Control**: Management of AI conversation agents.
- **Live Prompt Injection**: Dynamic modification of AI prompts during calls.
- **Call Management**: Unified interface for outbound calls and call control.

### System Design Choices
The architecture emphasizes modularity, scalability, and ease of deployment. Key decisions include:
- Exclusive use of FaleVono as the telephony provider for streamlined integration.
- ESM for modern JavaScript development and compatibility with Vite.
- CommonJS module loading for SIP library via createRequire (fixes "sip.send is not a function").
- Singleton pattern for SIPService to prevent multiple stack instances.
- Containerization with Docker for consistent deployment across environments.
- Comprehensive `DEPLOY.md` documentation for simplified setup and troubleshooting.
- Robust error handling and state management for SIP dialogues.

### Known Limitations
- **Replit Development Environment**: UDP ports are blocked, preventing SIP registration in development mode. The system will show timeout errors when attempting calls. **Solution**: Deploy to production (EasyPanel, VPS, or local Docker) where UDP traffic is allowed.

## External Dependencies

### Telephony Providers
- **FaleVono**: Primary Brazilian VoIP provider via SIP protocol.

### AI and Speech Services
- **ElevenLabs**: Voice synthesis (TTS) for Portuguese.
- **Deepgram**: Real-time speech-to-text (STT) transcription for Portuguese.
- **OpenAI**: AI conversation logic and live prompt injection.

### Frontend Dependencies
- **shadcn/ui**: React component library built on Radix UI.
- **Radix UI**: Unstyled, accessible component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **React Hook Form**: Form handling with validation.

### Development and Build Tools
- **Vite**: Fast build tool and development server.
- **TypeScript**: Static typing for frontend and backend.
- **Drizzle Kit**: Database migration and schema management.
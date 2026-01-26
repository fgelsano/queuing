# Web-based Queuing System

The application is a web-based queuing system that lets organizations manage walk-in clients more efficiently while giving clients the freedom to leave the waiting area without losing their place in line.

At its core, the system replaces manual, paper-based queue numbers with a fully digital, role-based platform:

- **Clients** scan a QR code, enter their name and concern, and instantly receive a uniquely formatted queue number (e.g., `012526-0001`, which resets daily). They are then taken to a success page that not only shows their own number and status, but also displays all currently open service windows and the queue number each window is serving in real time. This same page can be opened on their phone, so they can monitor progress from anywhere.

- **Staff** log in, operate specific windows, see the list of waiting clients, and manually prioritize seniors, PWDs, and pregnant clients when needed. They manage the flow of "waiting → being served → served / skipped" and see their own performance stats and charts based on the clients they've handled.

- **Admins** configure windows, define client concern categories and sub-concerns, manage staff accounts, and run department-wide reports with date and category filters. They effectively control how the entire queuing system behaves day to day.

## The Problem It Solves

The key problem this system solves is the current pain point where clients are forced to physically stay in the waiting area for long periods because they fear missing their number and losing their turn. Even if they already have a number, they feel "tied" to the counter.

This application removes that anxiety by combining three ideas:

1. **Public, live queue visibility**: The success page and public monitoring page show all active windows and the numbers currently being served, updated every 1–3 seconds. Clients can check from their phones instead of watching a physical board or listening for announcements.

2. **Persistent client queue info in the browser**: The client's queue number and details are stored in `localStorage`, so if they accidentally close or refresh the browser, their number isn't lost. The system automatically invalidates this local data when a new day starts, matching the daily reset of queue numbers.

3. **Window-based, dynamic service view**: Only active windows are shown, each as a card in a responsive layout. Clients can tell at a glance how many windows are serving and which numbers are currently being processed.

Together, these features allow clients to stay in the queue while running other errands outside—they keep their number, can always see where the queue stands, and can confidently time their return without worrying about breaking the line.

On top of that, the built-in video player that auto-plays and loops locally stored movies on the public page enhances the on-site waiting experience for anyone who does choose to stay, while the analytics for staff and admins add operational value beyond a simple "take-a-number" system.

Overall, it's impressive because it takes a familiar, everyday process and elevates it into a smart, data-driven, and client-friendly experience: highly usable on mobile, aware of priority policies, rich in reporting, and thoughtfully designed to reduce frustration for both clients and staff.

## Tech Stack

- **Frontend**: React 18 with Vite
- **Backend**: Node.js with Express
- **Database**: SQLite/PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Authentication**: JWT

## Documentation

- **Setup Guide**: See [SETUP.md](./SETUP.md) for local development setup instructions
- **Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions

## Usage

### Client Flow

1. Access the system via QR code or navigate to `/`
2. Fill in the registration form
3. Get assigned a queue number (format: `MMDDYY-XXXX`)
4. Monitor queue status on the success page
5. View public monitoring page at `/monitor`

### Staff Flow

1. Login at `/staff/login`
2. Assign yourself to a window
3. Manage queue: start serving, mark as served, or skip
4. View analytics and statistics

### Admin Flow

1. Login at `/admin/login`
2. Manage staff accounts
3. Configure windows
4. Set up categories and subcategories
5. View comprehensive reports

## Queue Number Format

Queue numbers follow the format: `MMDDYY-XXXX`
- `MMDDYY`: Date prefix (e.g., 012526 for January 25, 2026)
- `XXXX`: 4-digit daily counter starting at 1

The counter resets daily and is concurrency-safe.

## API Endpoints

### Public Endpoints
- `POST /api/queue/join` - Join queue
- `GET /api/queue/:queueNumber` - Get queue entry
- `GET /api/queue/public/windows` - Get active windows
- `GET /api/categories` - Get categories
- `GET /api/videos` - Get video list

### Staff Endpoints (Requires Authentication)
- `GET /api/staff/dashboard` - Get dashboard data
- `POST /api/staff/assign-window` - Assign window
- `POST /api/staff/serve/:id` - Start serving
- `POST /api/staff/complete/:id` - Mark as served
- `POST /api/staff/skip/:id` - Skip client
- `GET /api/staff/analytics` - Get analytics

### Admin Endpoints (Requires Authentication)
- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/staff` - Get all staff
- `POST /api/admin/staff` - Create staff
- `PUT /api/admin/staff/:id` - Update staff
- `GET /api/admin/windows` - Get all windows
- `POST /api/admin/windows` - Create window
- `PUT /api/admin/windows/:id` - Update window
- `DELETE /api/admin/windows/:id` - Delete window
- `GET /api/admin/categories` - Get categories
- `POST /api/admin/categories` - Create category
- `PUT /api/admin/categories/:id` - Update category
- `DELETE /api/admin/categories/:id` - Delete category
- `GET /api/admin/reports` - Get reports

## Database Schema

The system uses Prisma with the following main models:
- `Admin` - Admin accounts
- `Staff` - Staff accounts
- `Window` - Service windows
- `Category` - Concern categories
- `SubCategory` - Subcategories
- `QueueEntry` - Queue entries
- `ServingLog` - Serving history for analytics
- `DailyCounter` - Daily queue counter

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Role-based access control
- Input validation
- SQL injection protection (Prisma)

## Real-time Updates

The system uses polling (every 2-3 seconds) for near real-time updates on:
- Public monitoring page
- Client success page
- Staff dashboard
- Admin dashboard

## Responsive Design

The system is fully responsive and works on:
- Mobile devices (primary for clients)
- Tablets
- Desktop computers

## License

MIT

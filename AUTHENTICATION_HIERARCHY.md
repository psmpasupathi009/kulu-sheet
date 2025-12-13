# New Authentication Hierarchy

## Overview

The application now uses a three-tier authentication hierarchy:

1. **Super Admin** (ENV only) - Not stored in database
2. **Admin** (Database) - Created by Super Admin
3. **User** (Database) - Created by Admins

## Environment Variables

```env
# Super Admin Email (ENV only - not stored in database)
SUPER_ADMIN_EMAIL="superadmin@company.com"

# JWT Secret
JWT_SECRET="your-secret-key-change-in-production"

# Email Configuration for OTP
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="your-email@gmail.com"
```

## Database Schema

### Admin Model
```prisma
model Admin {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  email      String    @unique
  name       String?
  phone      String?
  createdBy  String    // Email of Super Admin who created this admin
  isActive   Boolean   @default(true)
  otp        String?
  otpExpires DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

### User Model
```prisma
model User {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  email      String    @unique
  name       String?
  phone      String?
  userId     String?   @unique
  role       UserRole  @default(USER)
  createdBy  String    // Email of Admin who created this user
  otp        String?
  otpExpires DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

## Login Flow

### Step 1: User enters email
- User submits email in login form

### Step 2: System checks hierarchy
1. **Super Admin Check**: Compare email with `SUPER_ADMIN_EMAIL` from ENV
2. **Admin Check**: Query `admins` collection in database
3. **User Check**: Query `users` collection in database

### Step 3: OTP sent
- Generate 6-digit OTP
- Store OTP (Super Admin: in-memory, Admin/User: database)
- Send OTP via email

### Step 4: OTP validation
- User enters OTP
- System verifies OTP
- Create JWT token with role
- Set auth cookie
- Redirect to role-based dashboard

## Dashboard Routes

- **Super Admin**: `/super-admin`
- **Admin**: `/admin`
- **User**: `/user`

## API Routes

### Authentication
- `POST /api/auth/login` - Request/validate OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Super Admin
- `GET /api/super-admin/admins` - List all admins
- `POST /api/super-admin/admins` - Create new admin

### Admin
- `GET /api/admin/users` - List users created by admin
- `POST /api/admin/users` - Create new user

## Role Permissions

### Super Admin
- Create Admins
- View all Admins and Users
- Manage system settings
- Full system access

### Admin
- Create Users
- View/manage Users created by them
- View their own profile
- Limited to their created users

### User
- View their own profile
- Read-only access to their data

## Important Notes

1. **Super Admin OTP Storage**: Currently uses in-memory storage (Map). In production, use Redis or similar for distributed systems.

2. **Super Admin**: Never stored in database. Only checked against ENV variable.

3. **Created By Tracking**: Both Admins and Users track who created them via `createdBy` field.

4. **OTP Expiration**: All OTPs expire after 10 minutes.

5. **JWT Token**: Contains user ID, email, and role. Valid for 7 days.

## Migration Notes

- Old `ADMIN_EMAIL` environment variable replaced with `SUPER_ADMIN_EMAIL`
- Old admin users in database need to be migrated to new `admins` collection
- Old user authentication code has been removed
- All forms except login have been removed


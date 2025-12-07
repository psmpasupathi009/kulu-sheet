# kulu-sheet - Complete Usage Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Initial Setup](#initial-setup)
4. [Complete Workflow](#complete-workflow)
5. [Feature-by-Feature Guide](#feature-by-feature-guide)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

**kulu-sheet** is a financial management system for managing ROSCA (Rotating Savings and Credit Association) groups. The system operates on a **monthly, interest-free** model where:

- Members contribute a fixed amount monthly (default: ₹2000)
- Each month, one member receives the collected funds as a loan
- Loans are repaid over 10 months without interest
- New members joining mid-cycle must pay back-payments for missed months

### Key Features
- **Monthly Investment System**: Members invest monthly amounts
- **Interest-Free Loans**: Loans repaid over 10 months with no interest
- **ROSCA Groups**: Manage multiple rotating credit groups
- **Loan Cycles**: Track multiple cycles per group
- **Member Management**: Complete member profiles with photos
- **Savings Tracking**: Track individual member savings
- **Event Management**: Record and manage group events
- **Monthly Statements**: Generate and view monthly reports

---

## Database Schema

### Core Models

#### 1. **User** (Authentication)
- Stores login credentials and user roles (ADMIN/USER)
- OTP-based authentication system
- Links to Member profile

#### 2. **Member** (Member Profiles)
- Personal information (name, address, phone, photo)
- Account number for identification
- Links to all financial records (savings, loans, transactions)

#### 3. **Group** (ROSCA Groups)
- Group name and configuration
- `monthlyAmount`: Default monthly contribution (₹2000)
- `loanMonths`: Loan repayment duration (10 months)
- `penaltyLoanPercent`: Penalty percentage for late payments (10%)

#### 4. **GroupMember** (Group Membership)
- Links members to groups
- `joiningMonth`: When member joined (1, 2, 3...)
- `monthlyAmount`: Individual member's contribution
- `totalContributed`: Total amount contributed
- `totalReceived`: Total amount received as loans
- `benefitAmount`: Amount eligible to receive

#### 5. **LoanCycle** (Investment Cycles)
- Represents one complete rotation cycle
- `cycleNumber`: Sequential cycle number (1, 2, 3...)
- `monthlyAmount`: Contribution amount per member
- `currentMonth`: Current month in cycle (0-10)
- Links to Group and GroupFund

#### 6. **LoanSequence** (Loan Order)
- Defines which member gets loan in which month
- `month`: Month number (1-10)
- `loanAmount`: Amount to be disbursed
- `status`: PENDING, DISBURSED, COMPLETED

#### 7. **Loan** (Actual Loans)
- `principal`: Original loan amount
- `remaining`: Remaining balance
- `months`: Loan duration (10 months)
- `currentMonth`: Current repayment month
- `status`: PENDING, ACTIVE, COMPLETED, DEFAULTED
- No interest rate (interest-free system)

#### 8. **LoanTransaction** (Loan Payments)
- Records each monthly payment
- `amount`: Principal payment
- `penalty`: Late payment penalty (if any)
- `month`: Payment month number

#### 9. **MonthlyCollection** (Monthly Contributions)
- Tracks monthly collections from all members
- `month`: Month number in cycle
- `totalCollected`: Total amount collected
- `expectedAmount`: Expected amount based on active members
- `activeMemberCount`: Number of active members

#### 10. **CollectionPayment** (Individual Payments)
- Individual member's monthly contribution
- `amount`: Payment amount (default ₹2000)
- `paymentDate`: When payment was made
- `status`: PENDING, PAID, OVERDUE

#### 11. **GroupFund** (Group Treasury)
- `investmentPool`: Accumulated monthly contributions
- `totalFunds`: Total available funds
- Tracks group's financial pool

#### 12. **Savings** (Member Savings)
- Individual member's savings account
- `totalAmount`: Current savings balance
- Links to SavingsTransaction records

#### 13. **Transaction** (Miscellaneous Transactions)
- General financial transactions
- Types: SAVINGS, LOAN, INTEREST, MISCELLANEOUS, COLLECTION, PENALTY

#### 14. **Event** (Group Events)
- Event name, date, description
- Photo gallery support

#### 15. **MonthlyStatement** (Reports)
- Monthly PDF statements
- Unique by month and year

---

## Initial Setup

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Connection
DATABASE_URL="mongodb://localhost:27017/kulu"
# OR for MongoDB Atlas:
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/kulu?retryWrites=true&w=majority"

# JWT Secret (change in production)
JWT_SECRET="your-secret-key-change-in-production"

# Admin Email
ADMIN_EMAIL="admin@example.com"

# Email Configuration (for OTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"  # Gmail App Password
EMAIL_FROM="your-email@gmail.com"
```

### 2. Database Setup

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio to view database
npm run db:studio
```

### 3. Start the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

The application will be available at `http://localhost:3000`

---

## Complete Workflow

### Phase 1: Initial Setup (Admin)

1. **Login as Admin**
   - Go to `/auth/login`
   - Enter admin email (set in `ADMIN_EMAIL`)
   - Receive OTP via email
   - Enter OTP to login

2. **Create Members**
   - Navigate to "Member Details" → "New Member"
   - Fill in member information:
     - Name, Father's Name
     - Address, Phone
     - Account Number
     - Upload Photo (optional)
   - Save member

3. **Create ROSCA Group**
   - Navigate to "ROSCA Groups" → "New Group"
   - Enter group name
   - Set monthly amount (default: ₹2000)
   - Set loan months (default: 10)
   - Set penalty percentage (default: 10%)
   - Save group

### Phase 2: Group Setup

4. **Add Members to Group**
   - Open the group
   - Click "Add Member"
   - Select member from list
   - Set joining month (1 for first month, higher for later)
   - Set monthly contribution amount
   - Save

   **Note**: New members joining mid-cycle must pay back-payments for all months before their joining month.

5. **Create Loan Cycle**
   - Navigate to "Loan Cycles" → "New Cycle"
   - Select group
   - Set start date
   - Set monthly amount per member
   - System automatically:
     - Creates LoanSequence for each month
     - Creates GroupFund for tracking
     - Initializes MonthlyCollection records

### Phase 3: Monthly Operations

6. **Monthly Collection**
   - Navigate to "Loan Cycles" → Select cycle
   - View current month's collection
   - Members pay their monthly contribution (₹2000)
   - Record payments:
     - Payment date
     - Payment method (UPI, Cash, etc.)
     - Status updates to PAID

7. **Disburse Loan**
   - After collection is complete
   - Navigate to "Loan Cycles" → Select cycle
   - View LoanSequence for current month
   - Click "Disburse Loan"
   - System:
     - Creates Loan record
     - Updates GroupFund
     - Marks sequence as DISBURSED
     - Updates member's totalReceived

8. **Loan Repayment**
   - Navigate to "Loan Details" → Select loan
   - View payment schedule (10 months)
   - Record monthly payment:
     - Payment amount (principal only, no interest)
     - Payment date
     - Overdue months (if late)
   - System calculates penalty if overdue
   - Updates loan status (ACTIVE → COMPLETED when fully paid)

### Phase 4: Ongoing Management

9. **Track Progress**
   - View cycle status in "Loan Cycles"
   - Check member contributions in group details
   - Monitor loan repayments in "Loan Details"

10. **Start New Cycle**
    - After cycle completes (10 months)
    - Create new cycle for the group
    - Reset monthly collections
    - Continue with new rotation

---

## Feature-by-Feature Guide

### 1. Authentication

#### Admin Login
1. Go to `/auth/login`
2. Enter admin email
3. Click "Send Passcode"
4. Check email for 6-digit OTP
5. Enter OTP and login

#### User Login
1. Admin must create user first (via Member creation)
2. User enters their email
3. Receives OTP
4. Enters OTP to login

**Note**: Only users created by admin can login.

### 2. Member Management

#### Create Member
- Path: "Member Details" → "New Member"
- Required: Name, User ID (for login)
- Optional: Address, Phone, Photo, Account Number
- Each member gets a unique User ID for login

#### View Member Details
- Path: "Member Details" → Click member
- View: Profile, Savings, Loans, Transactions, Group Memberships

#### Edit Member
- Open member details
- Click "Edit"
- Update information
- Save changes

### 3. ROSCA Groups

#### Create Group
- Path: "ROSCA Groups" → "New Group"
- Fields:
  - **Name**: Group identifier
  - **Monthly Amount**: Default contribution (₹2000)
  - **Loan Months**: Repayment period (10 months)
  - **Penalty %**: Late payment penalty (10%)

#### Add Members to Group
- Open group details
- Click "Add Member"
- Select member
- Set:
  - **Joining Month**: When they joined (1 = first month)
  - **Monthly Amount**: Their contribution
- System calculates back-payments if joining month > 1

#### View Group Details
- See all members
- View active cycles
- Check group fund status
- View collection history

### 4. Loan Cycles

#### Create Cycle
- Path: "Loan Cycles" → "New Cycle"
- Select group
- Set start date
- Set monthly amount
- System creates:
  - 10 LoanSequence records (one per month)
  - GroupFund record
  - Initial MonthlyCollection records

#### View Cycle
- See current month
- View all loan sequences
- Check collection status
- View group fund balance

#### Disburse Loan
- Navigate to cycle
- Find current month's sequence
- Click "Disburse Loan"
- Loan is created and funds transferred

### 5. Loan Management

#### View Loans
- Path: "Loan Details"
- See all loans with status:
  - **PENDING**: Approved but not disbursed
  - **ACTIVE**: Being repaid
  - **COMPLETED**: Fully repaid
  - **DEFAULTED**: Payment default

#### Repay Loan
- Open loan details
- View payment schedule (10 months)
- Click "Make Payment"
- Enter:
  - Payment amount
  - Payment date
  - Overdue months (if late)
- System calculates penalty automatically
- Updates loan balance and status

#### Loan Details View
- Payment schedule
- Transaction history
- Remaining balance
- Current month

### 6. Savings

#### Add Savings
- Path: "Savings" → Select member → "Add Transaction"
- Enter amount and date
- System updates total savings

#### View Savings
- See total balance
- View transaction history
- Filter by date range

### 7. Collections

#### Record Payment
- Navigate to cycle
- View current month's collection
- Click on member's payment
- Mark as PAID
- Enter payment method

#### View Collection Status
- See who has paid
- Check expected vs collected
- View overdue payments

### 8. Events

#### Create Event
- Path: "Events" → "New Event"
- Enter name, date, description
- Upload photos (multiple)
- Save

#### View Events
- See all events
- View photos
- Filter by date

### 9. Monthly Statements

#### Upload Statement
- Path: "Monthly Statements"
- Select month and year
- Upload PDF file
- Save

#### View Statements
- Browse by month/year
- Download PDFs

### 10. Miscellaneous Transactions

#### Add Transaction
- Path: "Miscellaneous" → "New Transaction"
- Select member
- Enter type, amount, date, purpose
- Upload photo (optional)
- Save

#### View Transactions
- Filter by member
- Filter by type
- View transaction history

---

## Common Tasks

### Task 1: Setting Up a New Group

1. **Create Group**
   ```
   ROSCA Groups → New Group
   Name: "Group A"
   Monthly Amount: ₹2000
   Loan Months: 10
   Penalty: 10%
   ```

2. **Add 10 Members**
   ```
   For each member:
   - Select member
   - Joining Month: 1 (all start together)
   - Monthly Amount: ₹2000
   ```

3. **Create Cycle**
   ```
   Loan Cycles → New Cycle
   - Select "Group A"
   - Start Date: 2025-01-01
   - Monthly Amount: ₹2000
   ```

4. **System Auto-Creates**
   - 10 LoanSequence records (one per month)
   - GroupFund initialized
   - MonthlyCollection records for 10 months

### Task 2: Monthly Collection Process

1. **Navigate to Cycle**
   ```
   Loan Cycles → Select cycle → View current month
   ```

2. **Record Payments**
   ```
   For each member:
   - Click "Record Payment"
   - Enter payment date
   - Select payment method
   - Mark as PAID
   ```

3. **Check Status**
   ```
   View: Total Collected vs Expected
   All members paid? → Ready to disburse
   ```

### Task 3: Disbursing a Loan

1. **Verify Collection Complete**
   ```
   All members have paid for current month
   Total collected = Expected amount
   ```

2. **Disburse Loan**
   ```
   Loan Cycles → Current month sequence
   Click "Disburse Loan"
   ```

3. **System Actions**
   - Creates Loan record
   - Updates GroupFund (deducts loan amount)
   - Marks sequence as DISBURSED
   - Updates member's totalReceived

### Task 4: Recording Loan Repayment

1. **Navigate to Loan**
   ```
   Loan Details → Select loan
   ```

2. **Make Payment**
   ```
   Click "Make Payment"
   Enter:
   - Payment Amount: ₹2000 (or principal portion)
   - Payment Date: Today
   - Overdue Months: 0 (or number if late)
   ```

3. **System Updates**
   - Deducts from loan remaining balance
   - Adds penalty if overdue
   - Updates currentMonth
   - Changes status to COMPLETED when balance = 0

### Task 5: Adding Member Mid-Cycle

1. **Add to Group**
   ```
   ROSCA Groups → Select group → Add Member
   - Select member
   - Joining Month: 5 (joining in month 5)
   - Monthly Amount: ₹2000
   ```

2. **System Calculates Back-Payment**
   ```
   Months to pay back: 4 (months 1-4)
   Total back-payment: ₹8000 (4 × ₹2000)
   ```

3. **Record Back-Payments**
   ```
   System creates CollectionPayment records for months 1-4
   Member must pay all back-payments
   ```

4. **Continue Normal Payments**
   ```
   From month 5 onwards, pay monthly like others
   ```

### Task 6: Handling Late Payments

1. **Record Late Payment**
   ```
   Loan Details → Make Payment
   - Payment Amount: ₹2000
   - Overdue Months: 2 (2 months late)
   ```

2. **Penalty Calculation**
   ```
   Penalty = 10% of principal × overdue months
   Example: ₹20,000 loan, 2 months late
   Penalty = ₹20,000 × 10% × 2 = ₹4,000
   ```

3. **Total Payment**
   ```
   Principal: ₹2,000
   Penalty: ₹4,000
   Total: ₹6,000
   ```

### Task 7: Starting a New Cycle

1. **Complete Current Cycle**
   ```
   All 10 months completed
   All loans disbursed
   ```

2. **Create New Cycle**
   ```
   Loan Cycles → New Cycle
   - Select same group
   - New start date
   - Same monthly amount
   ```

3. **Reset for New Rotation**
   ```
   New sequences created
   New GroupFund initialized
   Members can receive loans again
   ```

---

## Workflow Diagrams

### Monthly Collection Flow
```
Month Starts
    ↓
Create/Open MonthlyCollection
    ↓
Members Pay Monthly Contribution
    ↓
Record CollectionPayments
    ↓
All Paid? → Yes → Disburse Loan to Sequence Member
    ↓
No → Track Overdue Payments
```

### Loan Repayment Flow
```
Loan Disbursed
    ↓
Monthly Payment Due
    ↓
Member Pays
    ↓
Record LoanTransaction
    ↓
Update Remaining Balance
    ↓
Balance = 0? → Yes → Mark COMPLETED
    ↓
No → Continue Next Month
```

### New Member Joining Flow
```
Member Added to Group
    ↓
Set Joining Month (e.g., Month 5)
    ↓
System Calculates Back-Payments
    ↓
Create CollectionPayment for Months 1-4
    ↓
Member Pays All Back-Payments
    ↓
Continue Normal Monthly Payments
```

---

## Important Notes

### Interest-Free System
- **No interest** is charged on loans
- Only principal amount needs to be repaid
- Penalty applies only for late payments (10% of principal per overdue month)

### Monthly System
- All operations are **monthly** (not weekly)
- Default contribution: ₹2000 per month
- Loan duration: 10 months
- One member receives loan each month

### Back-Payment System
- New members joining mid-cycle must pay for all previous months
- Example: Joining in month 5 → Pay for months 1-4
- Ensures fairness in the rotation

### Group Fund Management
- All contributions go to GroupFund
- Loans are disbursed from GroupFund
- System tracks total available funds
- Used for loan disbursements

### Loan Sequence
- Determined when cycle is created
- Each month, one member receives loan
- Order can be based on joining month or other criteria
- System tracks who receives loan in which month

---

## Troubleshooting

### Issue: OTP Not Received
- Check email configuration in `.env`
- Verify EMAIL_USER and EMAIL_PASS
- For Gmail, use App Password (not regular password)
- Check spam folder

### Issue: Member Cannot Login
- Verify member has User ID set
- Check if user exists in User table
- Ensure email matches exactly

### Issue: Back-Payment Not Calculated
- Verify joiningMonth is set correctly
- Check if CollectionPayment records were created
- Review group member details

### Issue: Loan Cannot Be Disbursed
- Verify all members have paid for current month
- Check GroupFund has sufficient balance
- Ensure LoanSequence status is PENDING

### Issue: Payment Not Reflecting
- Check loan status (must be ACTIVE)
- Verify payment amount matches expected
- Review LoanTransaction records

### Issue: Database Connection Error
- Verify DATABASE_URL in `.env`
- Check MongoDB is running (local) or accessible (Atlas)
- Ensure IP is whitelisted (for Atlas)
- Verify credentials

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/login` - Request/validate OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Members
- `GET /api/members` - List all members
- `POST /api/members` - Create member
- `GET /api/members/[id]` - Get member details
- `PUT /api/members/[id]` - Update member
- `DELETE /api/members/[id]` - Delete member

### Groups
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group
- `GET /api/groups/[id]` - Get group details
- `POST /api/groups/[id]/members` - Add member to group

### Cycles
- `GET /api/cycles` - List cycles
- `POST /api/cycles` - Create cycle
- `GET /api/cycles/[id]` - Get cycle details

### Loans
- `GET /api/loans` - List loans
- `POST /api/loans` - Create loan
- `POST /api/loans/disburse` - Disburse loan
- `POST /api/loans/repay` - Repay loan
- `GET /api/loans/[id]` - Get loan details

### Collections
- `GET /api/collections` - List collections
- `POST /api/collections` - Record payment

### Savings
- `GET /api/savings` - List savings
- `POST /api/savings` - Add savings transaction

---

## Best Practices

1. **Always verify collection is complete before disbursing loans**
2. **Record payments immediately to avoid confusion**
3. **Set joining month correctly for new members**
4. **Keep member information up to date**
5. **Regularly check loan repayment status**
6. **Back up database regularly**
7. **Use strong JWT_SECRET in production**
8. **Keep email credentials secure**

---

## Support

For issues or questions:
1. Check this guide first
2. Review error messages in browser console
3. Check server logs
4. Verify database connection
5. Review Prisma schema for data structure

---

**Last Updated**: December 2025
**Version**: 1.0
**System**: kulu-sheet - Monthly Interest-Free ROSCA Management System



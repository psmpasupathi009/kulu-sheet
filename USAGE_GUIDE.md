# Website Usage Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Member Management](#member-management)
4. [Financing Groups](#financing-groups)
5. [Monthly Collections](#monthly-collections)
6. [Loan Disbursement](#loan-disbursement)
7. [Loan Repayment](#loan-repayment)
8. [Savings Management](#savings-management)
9. [Dashboard Overview](#dashboard-overview)
10. [Common Workflows](#common-workflows)

---

## Getting Started

### System Overview
This is a **Financing Group Management System** where:
- Members form groups with variable sizes (any number of members)
- Each member invests a **fixed monthly amount** (e.g., ₹2,000)
- Every month, the **total pooled amount** is given as a loan to **one member**
- Each member receives the loan **once** during the cycle
- Members repay the loan over the remaining months of the cycle
- **No interest or penalties** - simple principal repayment only

### Key Features
- ✅ Variable group sizes (not limited to 10 members)
- ✅ Fixed monthly contributions from all members
- ✅ One loan per member per cycle
- ✅ Automatic loan completion when cycle ends
- ✅ Simple repayment (no interest/penalties)
- ✅ Admin controls for all operations
- ✅ Member-specific views

---

## Authentication

### Admin Login
1. Navigate to `/auth/login`
2. Enter your admin email address
3. Click **"Send Passcode"**
4. Check your email for a 6-digit OTP
5. Enter the OTP and click **"Login"**

### User Login
1. Admin must create your member account first
2. Navigate to `/auth/login`
3. Enter your registered email address
4. Click **"Send Passcode"**
5. Enter the OTP received via email
6. Click **"Login"**

**Note**: Only members created by admin can login.

---

## Member Management

### Create New Member (Admin Only)
1. Navigate to **"Member Details"** → **"New Member"**
2. Fill in the form:
   - **Name**: Full name of the member
   - **Father's Name**: (Optional)
   - **User ID**: Unique identifier for login (e.g., "MEMBER001")
   - **Email**: Email address for OTP login
   - **Phone**: Contact number
   - **Address**: Full address
   - **Account Number**: (Optional)
   - **Photo**: Upload member photo (optional)
3. Click **"Save Member"**

### View Member Details
1. Go to **"Member Details"** page
2. Click on any member's name or **"View"** button
3. View:
   - Member profile information
   - Total savings
   - Active loans
   - Payment history
   - Group memberships

### Edit Member (Admin Only)
1. Open member details page
2. Click **"Edit"** button
3. Update any information
4. Click **"Save Changes"**

### Delete Member (Admin Only)
1. Open member details page
2. Click **"Delete"** button
3. Confirm deletion in the dialog
4. **Warning**: This will delete all related records (savings, loans, etc.)

---

## Financing Groups

### Create Financing Group (Admin Only)
1. Navigate to **"Financing Groups"** page
2. Click **"New Financing Group"** button
3. Fill in the form:
   - **Group Name**: Name for the group (e.g., "Group A")
   - **Monthly Amount**: Fixed amount each member pays per month (e.g., ₹2,000)
   - **Start Date**: When the group cycle begins
   - **Members**: Select 2 or more members (use checkboxes)
4. Click **"Create Group"**

**Important Notes**:
- Minimum 2 members required
- All members pay the same fixed amount monthly
- Group size determines cycle duration (4 members = 4 months cycle)
- Each member will receive one loan during the cycle

### View Financing Groups
1. Go to **"Financing Groups"** page
2. See all groups with:
   - Group name and number
   - Current month progress (e.g., "2/4")
   - Monthly amount and total pooled amount
   - Status (Active/Inactive)
   - Start date

### Edit Group (Admin Only)
1. Open the group card
2. Click **"Edit"** button (if no collections/loans exist)
3. Update:
   - Group name
   - Monthly amount (only if no collections)
   - Start date (only if no collections)
4. Click **"Save Changes"**

### Delete Group (Admin Only)
1. Open the group card
2. Click **"Delete"** button
3. Confirm deletion
4. **Note**: Can only delete if no collections or loans exist

---

## Monthly Collections

### Record Monthly Payment (Admin Only)
1. Navigate to **"Financing Groups"** page
2. Open the group you want to record payments for
3. Click **"Record Payment"** button
4. Fill in the form:
   - **Month**: Select the month (e.g., "January 2025")
   - **Date**: Payment date (auto-selected based on month)
   - **Members**: Select one or more members (use checkboxes)
   - **Amount**: Monthly contribution amount (auto-filled from group)
   - **Payment Method**: Cash, UPI, or Bank Transfer
5. Click **"Record Payment"**

**Features**:
- Only unpaid members are shown in the list
- Date is auto-selected based on the selected month
- Can select multiple members at once
- Prevents duplicate payments for the same month

### View Collection Status
1. Open a financing group
2. Scroll to **"Collections History"** section
3. View:
   - Month name (e.g., "January 2025")
   - Collection date
   - Total collected amount
   - Status (Completed/Pending)
   - Loan disbursement status

### Edit Collection (Admin Only)
1. In the Collections History table
2. Click **"Edit"** button (pencil icon) for a collection
3. Update the collection date
4. Click **"Save"**

### Delete Collection (Admin Only)
1. In the Collections History table
2. Click **"Delete"** button (trash icon) for a collection
3. Confirm deletion
4. **Note**: Cannot delete if loan has been disbursed from that collection

---

## Loan Disbursement

### Give Loan to Member (Admin Only)
1. Navigate to **"Financing Groups"** page
2. Open the group
3. Ensure the current month's collection is **completed** (all members paid)
4. Click **"Give Loan"** button
5. Select the member who will receive the loan
6. Choose disbursement method (Cash, UPI, or Bank Transfer)
7. Click **"Disburse Loan"**

**Important Rules**:
- Only one member can receive a loan per month
- Each member can receive only **one loan per group**
- Loan amount = Total collected from all members that month
- Member's cumulative contributions are deducted from remaining amount
- Remaining amount = Loan amount - Member's contributions up to loan month

**Example** (4-member group, ₹2,000/month):
- Month 1: All pay ₹2,000 → Total ₹8,000 → Give to Member A
  - Member A already paid ₹2,000 → Remaining ₹6,000 to repay
- Month 2: All pay ₹2,000 → Total ₹8,000 → Give to Member B
  - Member B already paid ₹4,000 (months 1+2) → Remaining ₹4,000 to repay

### Reverse Loan Disbursement (Admin Only)
1. In the Collections History table
2. Find the collection with a disbursed loan
3. Click **"Reverse"** button
4. Confirm reversal
5. **Note**: Can only reverse if no repayments have been made

---

## Loan Repayment

### Record Loan Payment (Admin Only)
1. Navigate to **"Loan Details"** page
2. Click on a loan to view details
3. Click **"Make Payment"** button
4. Fill in the form:
   - **Payment Date**: Date of payment
   - **Payment Method**: Cash, UPI, or Bank Transfer
5. Click **"Record Payment"**

**Features**:
- Monthly payment = Group's monthly amount (e.g., ₹2,000)
- Automatically prevents duplicate payments for the same month
- Shows which months are already paid
- Updates remaining balance automatically
- Marks loan as COMPLETED when fully paid

### View Loan Details
1. Go to **"Loan Details"** page
2. Click **"View"** button for any loan
3. See:
   - Loan amount and remaining balance
   - Repayment progress (e.g., "2/4 months")
   - Payment schedule
   - Transaction history
   - Loan status (Active/Completed)

### Delete Loan Transaction (Admin Only)
1. Open loan details page
2. Scroll to **"Transaction History"** section
3. Click **"Delete"** button for a transaction
4. Confirm deletion
5. Loan balance and status will be recalculated automatically

---

## Savings Management

### Record Savings Contribution
1. Navigate to **"Savings"** page
2. Click **"Record Contribution"** button
3. Fill in the form:
   - **Group**: Select financing group (optional)
   - **Month**: Select month for monthly contribution
   - **Member**: Select member (only unpaid members shown)
   - **Date**: Payment date (auto-selected)
   - **Amount**: Contribution amount (auto-filled from group)
   - **Payment Method**: Cash, UPI, or Bank Transfer
4. Click **"Record Contribution"**

**Note**: Monthly contributions are automatically linked to financing groups.

### View Savings
1. Go to **"Savings"** page
2. See all savings records with:
   - Member name (admin view) or your own savings (user view)
   - Total savings amount
   - Latest transaction date
   - Last transaction amount

### View Savings Details
1. Click **"View"** button for any savings record
2. See:
   - Total savings amount
   - Complete transaction history
   - Running totals
   - Transaction dates and amounts

### Edit Savings Transaction (Admin Only)
1. Open savings details page
2. Find the transaction in the history
3. Click **"Edit"** button
4. Update date and/or amount
5. Click **"Save"**
6. All subsequent running totals will be recalculated

### Delete Savings Transaction (Admin Only)
1. Open savings details page
2. Find the transaction
3. Click **"Delete"** button
4. Confirm deletion
5. Savings total will be recalculated automatically

---

## Dashboard Overview

### View Dashboard
1. Navigate to **"Dashboard"** (home page after login)
2. See summary statistics:
   - Total savings
   - Active loans
   - Total collections
   - Active groups

### View Data Tables
1. Use tabs to switch between:
   - **Savings**: All savings records
   - **Loans**: All active/completed loans
   - **Collections**: All monthly collections
   - **Groups**: All financing groups (admin only)

### Filter by Role
- **Admin**: Sees all data for all members
- **User**: Sees only their own savings and loans

---

## Common Workflows

### Workflow 1: Complete Group Cycle (4-Member Example)

**Step 1: Create Group**
- Create group with 4 members
- Set monthly amount: ₹2,000
- Start date: January 1, 2025

**Step 2: Month 1 Collection**
- All 4 members pay ₹2,000 each
- Total collected: ₹8,000
- Give loan to Member A
- Member A remaining: ₹6,000 (₹8,000 - ₹2,000 already paid)

**Step 3: Month 2 Collection**
- All 4 members pay ₹2,000 each
- Total collected: ₹8,000
- Give loan to Member B
- Member B remaining: ₹4,000 (₹8,000 - ₹4,000 already paid)
- Member A repays ₹2,000 (remaining: ₹4,000)

**Step 4: Month 3 Collection**
- All 4 members pay ₹2,000 each
- Total collected: ₹8,000
- Give loan to Member C
- Member C remaining: ₹2,000 (₹8,000 - ₹6,000 already paid)
- Member A repays ₹2,000 (remaining: ₹2,000)
- Member B repays ₹2,000 (remaining: ₹2,000)

**Step 5: Month 4 Collection**
- All 4 members pay ₹2,000 each
- Total collected: ₹8,000
- Give loan to Member D
- Member D remaining: ₹0 (₹8,000 - ₹8,000 already paid)
- Member A repays ₹2,000 (remaining: ₹0) → **COMPLETED**
- Member B repays ₹2,000 (remaining: ₹0) → **COMPLETED**
- Member C repays ₹2,000 (remaining: ₹0) → **COMPLETED**

**Result**: All members received ₹8,000 loan and repaid ₹8,000. Cycle complete!

### Workflow 2: Record Monthly Contribution via Savings Page

1. Go to **"Savings"** → **"Record Contribution"**
2. Select financing group
3. Select month (e.g., "February 2025")
4. Select member(s) who haven't paid yet
5. Date is auto-selected
6. Amount is auto-filled from group
7. Click **"Record Contribution"**
8. Payment is automatically linked to the financing group's collection

### Workflow 3: Loan Repayment Process

1. Member receives loan in Month 2
2. Loan amount: ₹8,000
3. Already paid: ₹4,000 (months 1+2)
4. Remaining: ₹4,000
5. Repayment months: 3 (totalMembers - loanMonth + 1 = 4 - 2 + 1)
6. Monthly payment: ₹2,000 (group's monthly amount)
7. Pays ₹2,000 in Month 3 → Remaining: ₹2,000
8. Pays ₹2,000 in Month 4 → Remaining: ₹0 → **COMPLETED**

---

## Important Formulas

### Loan Repayment Months
```
Repayment Months = Total Members - Loan Month + 1
```

**Examples**:
- 4 members, loan in month 1 → 4 - 1 + 1 = **4 months**
- 4 members, loan in month 2 → 4 - 2 + 1 = **3 months**
- 4 members, loan in month 4 → 4 - 4 + 1 = **1 month**

### Remaining Loan Amount
```
Remaining = Loan Amount - Member's Cumulative Contributions
```

**Example**:
- Loan amount: ₹8,000
- Member paid in months 1+2: ₹4,000
- Remaining: ₹8,000 - ₹4,000 = **₹4,000**

### Monthly Payment
```
Monthly Payment = Group's Monthly Amount (fixed for all members)
```

**Example**:
- Group monthly amount: ₹2,000
- All members pay ₹2,000/month regardless of when they got the loan

---

## Tips & Best Practices

1. **Always verify collection is complete** before giving a loan
2. **Check member eligibility** - each member can receive only one loan per group
3. **Use the correct month** when recording payments
4. **Double-check amounts** before saving
5. **Review loan details** regularly to track repayment progress
6. **Keep collections organized** by month for easy tracking
7. **Use edit/delete features** carefully - they affect calculations
8. **Monitor dashboard** for quick overview of all activities

---

## Troubleshooting

### Issue: Cannot record payment for a member
**Solution**: Check if the member has already paid for that month. Only unpaid members are shown in the selection list.

### Issue: Cannot give loan
**Solution**: Ensure all members have paid for the current month. Collection must be completed (total collected = expected amount).

### Issue: Loan remaining amount seems incorrect
**Solution**: The system automatically deducts the member's cumulative contributions. Check the loan details to see the breakdown.

### Issue: Savings amount not updating
**Solution**: Savings are automatically updated when recording contributions or loan repayments. If there's a discrepancy, check the transaction history.

### Issue: Cannot delete collection
**Solution**: Collections with disbursed loans cannot be deleted. You must reverse the loan first.

---

## Support

For issues or questions:
1. Check this usage guide
2. Review the loan details and transaction history
3. Verify all data is entered correctly
4. Contact the system administrator

---

**Last Updated**: January 2025
**Version**: 1.0

# LGU Cortes — Staff & Officer of the Day Setup

## 1. Firebase Authentication
In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.

Create one Firebase Authentication account for every department staff member and one account for the **Officer of the Day**.

## 2. Firestore staff documents
Create a matching document:

`staff/{AUTH_USER_UID}`

Department staff example:

```text
department: "Business Permit and Licensing Office"
email: "staff@example.com"
active: true
role: "staff"
```

Officer of the Day example:

```text
department: "Municipal Administrator's Office"
email: "officer@example.com"
active: true
role: "officer_of_day"
```

The Officer of the Day does not need to belong to a citizen-service department. Their account is allowed to **view all appointment requests and schedules across every office**, but the dashboard is read-only.

## 3. Deploy Firestore rules
Deploy the included `firestore.rules`. The rules enforce the access difference:

- Department staff → only their assigned department's requests.
- Officer of the Day → all requests/schedules from all departments.
- Citizens → only their own requests.

## 4. Officer of the Day dashboard
Open `admin.html`, select **Officer of the Day**, then sign in using the Firebase account.

The dashboard shows:
- Total requests
- Total scheduled appointments
- Pending requests
- Number of offices represented
- Citizen and service information
- Exact schedule
- Office/department assigned to each appointment
- Search and filters by office/status

The Officer of the Day cannot approve, reschedule, complete, or delete requests.

## 5. Alerts
The browser `alert()` popups have been replaced with animated toast notifications with:
- Success / error / warning / notice states
- Icon and title
- Slide-in animation
- Auto-dismiss progress bar
- Manual close button

## Admin Console Login (Username/Password)

The admin console keeps the original visible LGU usernames and passwords. Firebase Authentication is used only in the background for Firestore access.

Officer of the Day visible login:
- Username: `officer`
- Password: `officer123`
- Internal Firebase email: `officer@lgu-cortes.local`

Department staff visible logins remain:
- MPDO: `mpdo` / `mpdo123`
- BPLO: `bplo` / `bplo123`
- Treasurer: `treasurer` / `treasurer123`
- Mayor: `mayor` / `mayor123`
- HR: `hr` / `hr123`
- MSWDO: `mswdo` / `mswdo123`
- Budget: `budget` / `budget123`
- Civil Registry: `civil` / `civil123`
- Agriculture: `agri` / `agri123`
- DILG: `dilg` / `dilg123`

Each corresponding Firebase Authentication user must use the mapped internal email shown in `admin.html` and the same password. The Firebase UID must be the document ID in `staff/{UID}`, with `active: true` and the appropriate role/department.

For Officer of the Day, use `role: "officer_of_day"` and `active: true`.

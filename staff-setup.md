# LGU Cortes — Staff Setup

The staff console no longer uses passwords embedded in `admin.html`.

## 1. Enable Firebase Authentication
In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.

## 2. Create each staff account
Create an Email/Password user for every department staff member.

## 3. Create the matching Firestore document
In Firestore, create:

`staff/{AUTH_USER_UID}`

with:

```text
department: "Business Permit and Licensing Office"
email: "staff@example.com"
active: true
role: "staff"
```

The `department` value must exactly match the department name used by the citizen service list.

Repeat for every authorized staff account.

## 4. Deploy Firestore rules
Upload/deploy `firestore.rules` to Firebase. These rules prevent citizens from reading other citizens' requests and prevent a staff member from reading another department's requests.

## 5. EmailJS
The approval email uses the EmailJS service/template already configured in `script.js`. Verify that the service and template are active in your EmailJS account.

## 6. Cloudinary
The citizen upload uses the existing unsigned upload preset. Restrict the preset in Cloudinary as much as possible (allowed formats, file size, folder, and moderation) because browser uploads cannot keep an unsigned preset secret.

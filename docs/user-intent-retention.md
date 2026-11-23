# User intent and contact retention

The intent form is used for personalization and for follow-up about relevant business opportunities. A phone number is optional. Entering a number does not create an account, verify ownership, or authorize marketing contact. Follow-up consent is a separate unchecked choice; its timestamp and text version are retained for audit.

## Access

Only superusers or staff granted both `intents.view_userintent` and `intents.view_lead_contact` can access lead records in Django Admin. Follow-up notes and statuses are internal. There is no public API for listing leads or phone numbers. Users can view their own record and remove their contact number and active consent through the private profile.

Guest submissions require a same-origin CSRF token, an unpredictable UUIDv4 token, an empty honeypot field, and a Redis-backed limit of 10 attempts per client IP per hour. The application uses `REMOTE_ADDR` by default. If deployed behind a trusted reverse proxy, set `INTENT_TRUSTED_PROXY_IPS` to that proxy's exact IP address so the first `X-Forwarded-For` address can be used. Never trust that header from unlisted sources.

## Retention

- Guest records without contact consent: anonymize after 180 days from submission.
- Guest records with contact consent: anonymize after 365 days from submission, including unresolved follow-up cases. Export or resolve any necessary case before this deadline.
- Anonymization clears the guest token, phone, active consent and internal note. The non-identifying goal selection and consent timestamp/version remain for aggregate reporting and audit.
- Account-linked intent records remain while the account exists. Deleting an account cascades to its active intent record. A user may remove the separate lead contact number and consent at any time from the private profile.
- Guest records merged into an existing account have their temporary token and phone cleared immediately. The archived row is excluded from active statistics.

Run `python manage.py expire_intent_contacts` to preview, then `python manage.py expire_intent_contacts --apply` after review. Schedule the apply command daily in the deployment scheduler. No existing records are deleted by this command.

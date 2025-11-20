# Changes made for building images and create flow

This document lists the changes applied to add image support for `Building` and to enable a client-side create flow with image upload.

## Models
- `rentals/models.py`
  - Added fields to `Building`:
    - `title` (CharField)
    - `image` (ImageField) with `upload_to='buildings/%Y/%m/%d/'`, `null=True`, `blank=True`
    - `pets_allowed` (BooleanField)
    - `available_from` (DateField)
    - `created_by` (ForeignKey to `User`, nullable) for tracking creator
  - Left `location` as a required `PointField` (non-nullable) — coordinates must be provided when creating a building.

## Serializers
- `rentals/api/v1/serializers.py`
  - `BuildingSerializer` now declares an `image = serializers.ImageField(required=False, allow_null=True)`.
  - `create()` and `update()` now pop the `image` from `validated_data` and, if present, save it on the model instance.

## Views
- `rentals/api/v1/views.py`
  - `building_list_create` (PUT) now accepts multipart form data and will use `request.user` when authenticated as the creating user. Falls back to `user_id` in payload if unauthenticated.
  - `building_detail` (PATCH) now uses multipart/form-data parser classes so image uploads can be attached to updates.
  - Error handling and profile-building association are preserved.

## Settings and URLs
- `rentals_root/settings.py`
  - Added `MEDIA_URL = '/media/'` and `MEDIA_ROOT = os.path.join(BASE_DIR, 'media')` for uploaded files.
- `rentals_root/urls.py`
  - When `DEBUG` is true, the project now serves `MEDIA_URL` from `MEDIA_ROOT` via `django.conf.urls.static.static()`.

## Templates and Frontend
- `rentals/templates/rentals/account.html`
  - Building modal form now includes fields:
    - `title` (`name="title"`)
    - `image` (`type="file"`, `name="image"`, `accept="image/*"`)
    - changed coordinates input `name` to `location` and made it `required` with a helpful placeholder (`lat, long`).

- `rentals/static/rentals/js/account.js`
  - Added modular code to open the create modal, clear the form, let the user use device location to prefill coordinates, validate inputs, and submit the form as `multipart/form-data` using `FormData`.
  - The upload includes the image file automatically if provided.

## JavaScript - Notes
- The JS submits a `PUT` to `/rentals/api/v1/buildings/` with `FormData`. The request includes the `Authorization: Bearer <access_token>` header; ensure an active access token is present in `sessionStorage`.
- The form field names match the serializer/model fields (`location`, `image`, `title`, `address`, `rental_price`, etc.).

## How DRF handles file/image uploads
- DRF supports file and image uploads using the `MultiPartParser` and `FormParser` parser classes.
- When the request `Content-Type` is `multipart/form-data`, DRF populates `request.data` with form fields and file objects from `request.FILES`.
- Use `serializers.ImageField()` in serializers to accept uploaded images. The serializer will receive file-like objects which can be assigned to model `ImageField` instances.
- In views, ensure `parser_classes` include `MultiPartParser` / `FormParser` (or globally configure them) to accept file uploads.

## Deployment / Production notes
- Install `Pillow` (Python Imaging Library backend) for handling images: `pip install Pillow`.
- For production, do NOT serve media files from Django. Configure a proper media hosting strategy:
  - Use an object storage (S3, DigitalOcean Spaces) and configure `django-storages`.
  - Or configure your web server (Nginx) to serve files from the `MEDIA_ROOT` directory.
- Ensure `MEDIA_ROOT` is a directory writable by the application process and backed up appropriately.
- Set `DEBUG = False` and set allowed hosts / security settings before deploying.

## Database migrations
- After these changes, generate and run migrations:

```bash
source venv/bin/activate
python manage.py makemigrations rentals
python manage.py migrate
```

## Additional recommendations
- Add size/format validation for uploaded images (e.g., limit file size, enforce dimensions) either in serializer `validate_image` or via a custom validator.
- Consider generating thumbnails and storing them alongside original images (e.g., using `django-imagekit` or a background task).
- If you want to allow profile updates and building creation in a single form, split frontend requests into two API calls (user update + profile update) or implement a nested serializer on the backend.

*** End of changes

# Database Setup Guide — Hala Dresses

## Prerequisites
- PostgreSQL installed and running
- Node.js 18+

## 1. Configure Database
Edit `.env` and update DATABASE_URL:
```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/haladresses?schema=public"
```

## 2. Create Database
```bash
psql -U postgres -c "CREATE DATABASE haladresses;"
```

## 3. Run Migrations
```bash
npm run db:push
# or for full migration history:
npm run db:migrate
```

## 4. Seed Initial Data
```bash
npm run db:seed
```

This creates:
- **Admin**: admin@haladresses.com / Admin@12345
- **Seller**: seller@haladresses.com / Seller@12345
- **Customer**: customer@haladresses.com / Customer@12345
- 7 categories, 3 sample products, 2 coupons, default settings

## 5. View Database (GUI)
```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

## URLs
| Panel       | URL                          | Access         |
|-------------|------------------------------|----------------|
| Store       | http://localhost:3000        | Public         |
| Admin Panel | http://localhost:3000/admin  | ADMIN, SUPER_ADMIN, STAFF |
| Seller Panel| http://localhost:3000/seller | SELLER, ADMIN  |
| API         | http://localhost:3000/api/*  | Per-route auth |

## API Routes
| Method | URL                        | Description         |
|--------|----------------------------|---------------------|
| POST   | /api/auth/login            | Login               |
| POST   | /api/auth/register         | Register            |
| POST   | /api/auth/logout           | Logout              |
| GET    | /api/auth/me               | Current user        |
| GET    | /api/users                 | List users (admin)  |
| POST   | /api/users                 | Create user (admin) |
| GET    | /api/categories            | List categories     |
| POST   | /api/categories            | Create category     |
| GET    | /api/products              | List products       |
| POST   | /api/products              | Create product      |
| GET    | /api/orders                | List orders         |
| POST   | /api/orders                | Create order        |
| PATCH  | /api/orders/[id]           | Update order status |
| GET    | /api/inventory             | List inventory      |
| POST   | /api/inventory             | Adjust inventory    |
| GET    | /api/dashboard             | Dashboard stats     |
| GET    | /api/settings              | Get settings        |
| POST   | /api/settings              | Update settings     |
| GET    | /api/coupons               | List coupons        |
| POST   | /api/coupons               | Create coupon       |
| GET    | /api/payments (via orders) | Payment tracking    |

## Database Schema
16 tables:
- **users** — customers, sellers, admins with RBAC
- **sessions** — auth tokens (30-day expiry)
- **categories** — hierarchical (parent/child)
- **products** — with bilingual fields (nameEn/nameAr)
- **product_images** — multiple images per product
- **product_variants** — size/color combinations
- **orders** — with shipping address (JSON)
- **order_items** — with product snapshot at time of order
- **payments** — multi-gateway support
- **inventory** — per-variant stock tracking
- **inventory_transactions** — full audit trail
- **addresses** — user shipping addresses
- **coupons** — percentage/fixed discounts
- **reviews** — with approval workflow
- **wishlist** — per-user product saves
- **settings** — key-value store by group
- **notifications** — bilingual user notifications
- **audit_logs** — all admin actions logged

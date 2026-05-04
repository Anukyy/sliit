# 🏨 Hotel Management System

A full-stack hotel management system built with React, Node.js, and Python (ML).

## 📁 Project Structure

```
hotel-management/
├── frontend/               # React App
├── staff-service/          # Admin & Staff Management (Node.js) :5001
├── room-service/           # Room Management (Node.js)          :5002
├── reservation-service/    # Reservations & Payments (Node.js)  :5003
├── restaurant-service/     # Food & Menu Management (Node.js)   :5004
├── customer-service/       # Customer Accounts (Node.js)        :5005
├── review-service/         # Reviews API (Node.js)              :5006
└── ml-service/             # Sentiment Analysis (Python/Flask)  :8000
```

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+
- MongoDB

### Run a Service
```bash
cd staff-service
cp .env.example .env
npm install
npm run dev
```

### Run ML Service
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

## 🌿 Branch Strategy
- `main` → stable, production-ready
- `dev` → integration branch
- `feature/module-name` → feature branches

## 👥 Team
Add your team members here.

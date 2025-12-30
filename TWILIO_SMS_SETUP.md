# Twilio SMS Integration Setup Guide

This guide will help you configure SMS notifications for appointment bookings using Twilio.

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Click **Sign up** (or **Start for free**)
3. Fill in your details:
   - Email
   - Password
   - First & Last Name
4. Click **Start your free trial**
5. **Verify your email** (check inbox)
6. **Verify your phone number** with the code sent via SMS

✅ **You get $15 free credit to test!**

---

### Step 2: Get a Phone Number

**After signing up, Twilio will prompt you:**

1. **"What do you plan to build with Twilio?"**
   - Select: **"Send SMS"**

2. **"What language will you use?"**
   - Select: **"Node.js"** (or any, doesn't matter)

3. **"Get a phone number"**
   - Twilio will automatically assign you a phone number
   - This number can send SMS to **any phone number** (not limited like WhatsApp!)
   - Click **"Choose this number"** or **"Get a number"**

4. **Skip the tutorial** (or complete it if you want)

✅ **You now have a Twilio phone number!**

---

### Step 3: Get Your Credentials

1. Go to https://console.twilio.com/
2. You'll see your **Account Dashboard**
3. Look for the **"Account Info"** section (right side)
4. You'll see:
   - **Account SID:** `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` - **Copy this!**
   - **Auth Token:** (Click "Show" to reveal) - **Copy this!**

5. To find your phone number:
   - Go to **Phone Numbers** > **Manage** > **Active numbers**
   - Copy your number (format: `+1 234 567 8901`)

✅ **You have all 3 credentials!**

---

### Step 4: Configure Environment Variables

Create or update `apps/api/.env.local`:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12345678901

# Existing variables (keep these)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docs_mono
NEXTAUTH_SECRET=local-dev-secret-key-123
NEXTAUTH_URL=http://localhost:3003
```

**Replace with your actual values from Step 3!**

---

### Step 5: Install Dependencies

```bash
cd apps/api
pnpm install
```

This will install the `twilio` package.

---

### Step 6: Test SMS Notifications

1. **Restart your API server:**
   ```bash
   cd apps/api
   pnpm dev
   ```

2. **Start your public website:**
   ```bash
   cd apps/public
   pnpm dev
   ```

3. **Create a test booking:**
   - Go to: http://localhost:3000/doctores/maria-lopez
   - Click **"Agendar cita"**
   - Select a date and time
   - Fill in the form with **your real phone number**
   - Click **"Confirmar Reserva"**

4. **Check your phone!** 📱
   - You should receive an SMS with booking confirmation
   - Check API logs for: `✅ SMS sent to patient: +52...`

✅ **If you got the SMS, it works!**

---

## 💰 Pricing

### Free Trial
- ✅ **$15 free credit** when you sign up
- ✅ Enough for **~750 SMS messages** for testing
- ✅ No credit card required initially

### After Trial (Production)
**Mexico SMS Pricing:**
- **Sending:** ~$0.014 per SMS (1.4 cents USD)
- **Phone number:** ~$1.15/month

**Cost Examples:**
- **100 bookings/month:** 200 SMS = **$2.80 + $1.15 = $3.95/month**
- **500 bookings/month:** 1,000 SMS = **$14 + $1.15 = $15.15/month**
- **1,000 bookings/month:** 2,000 SMS = **$28 + $1.15 = $29.15/month**

**Very affordable for production!**

---

## 📱 How It Works

### Message Flow:

```
Patient books appointment
         ↓
Platform sends 2 SMS via Twilio:
         ↓
         ├→ To Patient: "¡Hola Juan! Tu cita confirmada..."
         └→ To Doctor: "Nueva cita - Paciente: Juan..."
```

### Patient Message Example:
```
¡Hola Juan Pérez!

Tu cita confirmada:
Dr. María López Hernández
martes, 31 de diciembre de 2025
10:00 - 10:30
Precio: $40

Codigo: ABC12345

Por favor llega 10 min antes.
```

### Doctor Message Example:
```
Nueva cita agendada

Paciente: Juan Pérez
Tel: +523315875992

martes, 31 de diciembre de 2025
10:00 - 10:30
Duracion: 30 min
Precio: $40

Codigo: ABC12345
```

---

## 🔧 Troubleshooting

### Issue: "⚠️ Twilio SMS not configured" in logs
**Solution:**
- Check that all 3 environment variables are set in `.env.local`
- Restart API server after adding variables
- Verify no typos in variable names

### Issue: SMS not received
**Solution:**
1. Check Twilio console logs: https://console.twilio.com/us1/monitor/logs/sms
2. Verify phone number format: `+523315875992` (country code + no spaces)
3. Check if you have trial credit remaining
4. For trial accounts, you may need to verify recipient numbers first

### Issue: "Unable to create record" error
**Solution:**
- **Trial accounts** can only send to verified phone numbers
- Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- Click **"Add a verified phone number"**
- Enter the phone number and verify with the code sent

### Issue: Trial credit exhausted
**Solution:**
- Go to https://console.twilio.com/billing
- Click **"Upgrade"** to add payment method
- You'll only be charged for actual usage (pay-as-you-go)

---

## 🎯 Production Deployment (Railway)

**When deploying to Railway:**

1. Go to your Railway project
2. Select the **api** service
3. Click **Variables**
4. Add these environment variables:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+12345678901
   ```
5. Save and redeploy

✅ **SMS notifications will work in production!**

---

## 🔄 Upgrading Trial to Production

**When you're ready to go live:**

1. Go to https://console.twilio.com/billing
2. Click **"Upgrade your account"**
3. Add payment method (credit card)
4. Remove trial limitations
5. **Benefits:**
   - Send to any phone number (no verification needed)
   - Higher rate limits
   - Access to all Twilio features

**No code changes needed** - just upgrade the account!

---

## 🆚 SMS vs WhatsApp Comparison

| Feature | SMS (Twilio) | WhatsApp (Meta) |
|---------|--------------|-----------------|
| **Setup Time** | ✅ 5 minutes | ❌ 15+ minutes |
| **Complexity** | ✅ Very simple | ❌ Complex |
| **Cost** | 💰 ~$0.014/SMS | ✅ FREE (service msgs) |
| **Trial** | ✅ $15 free credit | ❌ Complicated test setup |
| **Verification** | ✅ None needed | ❌ Business verification for scale |
| **Restrictions** | ✅ Send to any number | ❌ Test mode: 5 recipients only |
| **Reliability** | ✅ Very high | ⚠️ Account issues common |

**For MVP/Testing:** SMS is **much simpler** and works immediately!

---

## 📊 Multi-Doctor Support

**Same as WhatsApp approach:**

- ✅ **One platform Twilio number** sends all SMS
- ✅ **Each doctor** gets SMS notifications for their bookings
- ✅ **Each patient** gets personalized SMS about their doctor
- ✅ **Scalable** to hundreds of doctors

**Example:**
- Patient books with Dr. María → 2 SMS sent
  - To patient: "Tu cita con Dr. María..."
  - To Dr. María's phone: "Nueva cita - Paciente: Juan..."
- Patient books with Dr. Carlos → 2 SMS sent
  - To patient: "Tu cita con Dr. Carlos..."
  - To Dr. Carlos's phone: "Nueva cita - Paciente: Ana..."

---

## 🔗 Helpful Links

- [Twilio Console](https://console.twilio.com/)
- [SMS Logs](https://console.twilio.com/us1/monitor/logs/sms)
- [Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/active)
- [Billing & Usage](https://console.twilio.com/billing)
- [Twilio SMS Pricing](https://www.twilio.com/sms/pricing)
- [Twilio Documentation](https://www.twilio.com/docs/sms)

---

## 🎯 Next Steps

1. ✅ Create Twilio account (free trial)
2. ✅ Get phone number and credentials
3. ✅ Add to `.env.local`
4. ✅ Test with a booking
5. 📊 Monitor usage in Twilio console
6. 💳 Upgrade to production when ready
7. 🚀 Deploy to Railway with same credentials

---

## 📝 Important Notes

### Graceful Degradation
- If Twilio is not configured, bookings still work
- SMS sending happens in background and doesn't block bookings
- If SMS fails, booking is still created successfully

### Message Limits
- **Trial:** Can send to verified numbers only
- **Production:** No limits (pay per message)

### Phone Number Format
- **Must include country code:** `+523315875992`
- Our code automatically adds `+52` for Mexico if missing
- Handles spaces/dashes: `33 1587 5992` → `+523315875992`

### Logging
- All SMS operations are logged to console
- Check Twilio console for delivery status
- Track costs in Twilio billing dashboard

---

**Questions?** Check [Twilio SMS Documentation](https://www.twilio.com/docs/sms) or contact [Twilio Support](https://support.twilio.com/).

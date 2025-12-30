# 🧪 Billing System - Complete Test Plan

## Test Environment Setup

Before we begin testing, ensure:
1. ✅ Medplum server is running locally
2. ✅ Application is running (`npm run dev`)
3. ✅ You're logged in as an admin user
4. ✅ Database has at least one patient

---

## 🎯 TEST PLAN OVERVIEW

We'll test all 6 automatic charge types:
1. ✅ Visit Charges (5 types)
2. ✅ Medication Charges
3. ✅ Lab Charges
4. ✅ Imaging Charges
5. ✅ Bed Charges (Initial)
6. ✅ Bed Charges (Final/Discharge)

---

## PHASE 1: SETUP & CONFIGURATION (Admin)

### Step 1: Configure Default Data
Navigate to Admin sections and initialize defaults if not already done.

#### A. Initialize Lab Tests
```
1. Navigate to: Admin → Lab Tests
2. Click: "Initialize Defaults"
3. Wait for success notification
4. Verify: Table shows tests like CBC, CMP, Lipid Panel, etc.
```

**Expected Tests**:
- CBC (Complete Blood Count)
- CMP (Comprehensive Metabolic Panel)
- Lipid Panel
- TSH (Thyroid Stimulating Hormone)
- HbA1c

#### B. Initialize Imaging Tests
```
1. Navigate to: Admin → Imaging Tests
2. Click: "Initialize Defaults"
3. Wait for success notification
4. Verify: Table shows tests like X-Ray, CT, MRI, etc.
```

**Expected Tests**:
- Chest X-Ray
- CT Scan
- MRI
- Ultrasound
- Mammography

#### C. Initialize Diagnostic Providers
```
1. Navigate to: Admin → Diagnostic Providers
2. Click: "Initialize Defaults"
3. Wait for success notification
4. Verify: Providers listed
```

#### D. Initialize Medications
```
1. Navigate to: Admin → Medication Catalog
2. Click: "Initialize Defaults"
3. Wait for success notification
4. Verify: Medications like Amoxicillin, Lisinopril, etc.
```

**Expected Medications**:
- Amoxicillin
- Lisinopril
- Metformin
- Atorvastatin
- Levothyroxine

#### E. Create Departments
```
1. Navigate to: Admin → Departments
2. Click: "Add Department"
3. Fill in:
   - Name: "Intensive Care Unit"
   - Code: "ICU"
   - Type: "Inpatient"
4. Click: "Save"
5. Repeat for "Emergency Department" (ED, Emergency)
```

#### F. Create Beds
```
1. Navigate to: Admin → Beds
2. Click: "Add Bed"
3. Fill in:
   - Department: "Intensive Care Unit"
   - Bed Number: "ICU-1"
   - Room Number: "101"
   - Type: "Standard"
   - Status: "Available"
   - Daily Rate: 500.00
4. Click: "Save"
5. Create 2-3 more beds for testing
```

---

### Step 2: Set Pricing

#### A. Set Medication Prices
```
1. Navigate to: Admin → Medication Catalog
2. Find: "Amoxicillin"
3. Click: "Edit"
4. Set Price: 0.50 (per tablet)
5. Click: "Save"
6. Verify: Price column shows "$0.50"

Repeat for:
- Lisinopril: $0.75
- Metformin: $0.30
```

#### B. Set Lab Test Prices
```
1. Navigate to: Admin → Lab Tests
2. Find: "CBC"
3. Click: "Edit"
4. Set Price: 75.00
5. Click: "Save"
6. Verify: Price column shows "$75.00"

Repeat for:
- CMP: $85.00
- Lipid Panel: $65.00
- TSH: $45.00
```

#### C. Set Imaging Test Prices
```
1. Navigate to: Admin → Imaging Tests
2. Find: "Chest X-Ray"
3. Click: "Edit"
4. Set Price: 150.00
5. Click: "Save"
6. Verify: Price column shows "$150.00"

Repeat for:
- CT Scan: $500.00
- MRI: $800.00
- Ultrasound: $200.00
```

#### D. Verify Bed Pricing
```
1. Navigate to: Admin → Beds
2. Verify: "Daily Rate" column shows prices
3. If not set, edit each bed and add daily rate
```

**✅ Configuration Complete!**

---

## PHASE 2: TEST AUTOMATIC CHARGES

### TEST 1: Emergency Visit Charge ✅

**Goal**: Verify $150 charge created for emergency visit

**Steps**:
```
1. Navigate to: Home (patient list)
2. Click: Any patient name
3. Click: "Create Encounter" (in Quick Actions)
4. Fill in:
   - Class: Emergency
   - Status: In Progress
   - Type: "Chest pain"
   - Reason: "Patient presenting with chest pain"
5. Click: "Create Encounter"
```

**Expected Results**:
- ✅ Success notification appears
- ✅ Navigate to encounter page
- ✅ Encounter created

**Verify Charge**:
```
1. Click: "Billing" in header
2. Search: Patient name
3. Click: The encounter just created
4. Verify charges table shows:
   - Description: "Emergency Visit"
   - Amount: $150.00
   - Status: "billable"
```

**✅ PASS if charge appears**  
**❌ FAIL if no charge or wrong amount**

---

### TEST 2: Lab Order Charge ✅

**Goal**: Verify $75 charge created for CBC lab order

**Steps**:
```
1. From the encounter page (from Test 1)
2. Scroll to Quick Actions
3. Click: "Order Labs/Imaging"
4. Fill in:
   - Order Type: Lab Tests
   - Performing Organization: Any provider
   - Select Tests: Check "CBC"
   - Notes: "Routine bloodwork"
5. Click: "Save"
```

**Expected Results**:
- ✅ Success notification
- ✅ Order appears in "Orders" tab

**Verify Charge**:
```
1. Click: "Billing" in header
2. Search: Same patient
3. Click: Same encounter
4. Verify charges table now shows TWO charges:
   - Emergency Visit: $150.00
   - CBC: $75.00
5. Verify total: $225.00
```

**✅ PASS if both charges appear**  
**❌ FAIL if CBC charge missing**

---

### TEST 3: Imaging Order Charge ✅

**Goal**: Verify $150 charge created for Chest X-Ray

**Steps**:
```
1. From the same encounter page
2. Click: "Order Labs/Imaging"
3. Fill in:
   - Order Type: Imaging Tests
   - Performing Organization: Any provider
   - Select Tests: Check "Chest X-Ray"
   - Notes: "Rule out pneumonia"
4. Click: "Save"
```

**Expected Results**:
- ✅ Success notification
- ✅ Order appears in "Orders" tab

**Verify Charge**:
```
1. Click: "Billing" in header
2. Search: Same patient
3. Click: Same encounter
4. Verify charges table now shows THREE charges:
   - Emergency Visit: $150.00
   - CBC: $75.00
   - Chest X-Ray: $150.00
5. Verify total: $375.00
```

**✅ PASS if all three charges appear**  
**❌ FAIL if X-Ray charge missing**

---

### TEST 4: Inpatient Admission & Bed Charge ✅

**Goal**: Verify $200 admission + $500 bed charge

**Steps**:
```
1. Navigate back to: Patient page
2. Click: "Create Encounter" (new encounter)
3. Fill in:
   - Class: Inpatient
   - Status: In Progress
   - Type: "Pneumonia admission"
   - Reason: "Admitted for pneumonia treatment"
   - Department: "Intensive Care Unit"
   - Bed: "ICU-1"
   - Bed Notes: "Patient requires monitoring"
4. Click: "Create Encounter"
```

**Expected Results**:
- ✅ Success notification
- ✅ Navigate to new encounter page
- ✅ Bed section shows assigned bed

**Verify Charges**:
```
1. Click: "Billing" in header
2. Search: Same patient
3. Click: The NEW encounter (Inpatient)
4. Verify charges table shows TWO charges:
   - Description: "Inpatient Admission"
   - Amount: $200.00
   - Description: "Bed ICU-1"
   - Amount: $500.00
5. Verify total: $700.00
```

**✅ PASS if both admission and bed charges appear**  
**❌ FAIL if either charge missing**

---

### TEST 5: Medication Charge ✅

**Goal**: Verify medication charge (quantity × price)

**Prerequisite**: Must have inpatient encounter with patient

**Steps**:
```
1. From the inpatient encounter page
2. Scroll to Quick Actions
3. Click: "Prescribe Medication"
4. Fill in:
   - Medication: "Amoxicillin"
   - Dosage: "500mg"
   - Frequency: "Three times daily"
   - Duration: "7 days"
   - Quantity: 100
   - Location: Internal (important!)
   - Instructions: "Take with food"
5. Click: "Save"
```

**Expected Results**:
- ✅ Success notification
- ✅ Prescription appears in "Medications" tab

**Administer the Medication**:
```
1. Click: "Medications" tab
2. Find: Amoxicillin prescription
3. Click: "Administer" button
4. Fill in:
   - Quantity Administered: 30
   - Notes: "First dose administered"
5. Click: "Save"
```

**Expected Results**:
- ✅ Success notification
- ✅ Administration recorded

**Verify Charge**:
```
1. Click: "Billing" in header
2. Search: Same patient
3. Click: The inpatient encounter
4. Verify charges table now shows THREE charges:
   - Inpatient Admission: $200.00
   - Bed ICU-1: $500.00
   - Amoxicillin (NEW): $15.00 (30 × $0.50)
5. Verify total: $715.00
```

**✅ PASS if medication charge appears with correct calculation**  
**❌ FAIL if charge missing or wrong amount**

---

### TEST 6: Final Bed Charge (Discharge) ✅

**Goal**: Verify additional bed charges calculated on discharge

**Important**: This test requires waiting or manually changing the admission date in the database for realistic testing. For immediate testing, we'll test the calculation logic.

**Steps**:
```
1. From the inpatient encounter page
2. Find the bed section (shows current bed assignment)
3. Note the admission date/time
4. Click: "Release Bed" button
5. Confirm the action
```

**Expected Behavior**:
```
If admitted today and released today:
- Days = 1 (ceiling of hours / 24)
- Already charged: 1 day
- Additional charge: 0 days
- New charge: $0.00

If admitted yesterday and released today:
- Days = 2
- Already charged: 1 day
- Additional charge: 1 day × $500
- New charge: $500.00

If admitted 3 days ago and released today:
- Days = 4 (rounded up)
- Already charged: 1 day
- Additional charge: 3 days × $500
- New charge: $1,500.00
```

**Verify Charge**:
```
1. Click: "Billing" in header
2. Search: Same patient
3. Click: Same encounter
4. Check for additional bed charge
5. Verify: Calculation is correct based on days stayed
```

**For Immediate Testing**:
Since the encounter was just created, you'll likely see 0 additional days. That's CORRECT behavior!

**To Test Multi-Day Scenario**:
You would need to either:
- Wait 24+ hours before releasing the bed, OR
- Manually update the encounter's `period.start` in the database to an earlier date

**✅ PASS if calculation logic is correct**  
**❌ FAIL if charge calculated incorrectly**

---

## PHASE 3: PAYMENT PROCESSING TEST

### TEST 7: Record Payment ✅

**Goal**: Verify payment recording updates balance

**Steps**:
```
1. Click: "Billing" in header
2. Search: Test patient
3. Click: Any encounter with charges
4. Note: Current total balance
5. Click: "Add Payment"
6. Fill in:
   - Amount: 500.00
   - Method: Cash
   - Notes: "Test payment"
7. Click: "Save"
```

**Expected Results**:
- ✅ Success notification
- ✅ Payment appears in payments table
- ✅ Balance reduced by $500
- ✅ Total charges unchanged

**Example**:
```
Before payment:
- Total Charges: $715.00
- Total Payments: $0.00
- Balance: $715.00

After $500 payment:
- Total Charges: $715.00
- Total Payments: $500.00
- Balance: $215.00 ✅
```

**Test Multiple Payments**:
```
1. Click: "Add Payment" again
2. Amount: 215.00
3. Method: Credit Card
4. Click: "Save"
```

**Expected Final State**:
```
- Total Charges: $715.00
- Total Payments: $715.00
- Balance: $0.00 ✅ (Fully paid)
```

**✅ PASS if balance calculates correctly**  
**❌ FAIL if balance incorrect**

---

## PHASE 4: COMPREHENSIVE SCENARIO TEST

### TEST 8: Complete Patient Journey ✅

**Goal**: Test complete workflow from admission to payment

**Scenario**: Patient with pneumonia requiring 3-day hospital stay

#### Day 1: Emergency Arrival & Admission
```
1. Navigate to patient
2. Create emergency encounter
   - ✅ $150 emergency visit charge
3. Order Chest X-Ray
   - ✅ $150 imaging charge
4. Order CBC
   - ✅ $75 lab charge
5. Create inpatient encounter
   - ✅ $200 admission charge
   - ✅ $500 bed charge (day 1)
6. Prescribe Amoxicillin (100 tablets)
7. Administer 30 tablets
   - ✅ $15 medication charge

Day 1 Total: $1,090
```

#### Day 2: Continued Care (Simulated)
```
(In real scenario: wait 24 hours or update timestamps)

1. Administer 30 more tablets
   - ✅ $15 medication charge

Running Total: $1,105
```

#### Day 3: Discharge (Simulated)
```
(In real scenario: wait 48 more hours from admission)

1. Administer final 30 tablets
   - ✅ $15 medication charge
2. Release bed
   - ✅ $1,000 bed charge (2 additional days × $500)

Final Total: $2,120
```

#### Billing & Payment
```
1. Navigate to Billing
2. Verify all charges present
3. Record insurance payment: $1,500
4. Verify balance: $620
5. Record patient payment: $620
6. Verify balance: $0 ✅ Fully paid
```

---

## 📊 TEST RESULTS SUMMARY

Use this checklist to track your testing:

### Automatic Charge Tests:
- [ ] Emergency Visit ($150) - TEST 1
- [ ] Lab Order ($75 CBC) - TEST 2
- [ ] Imaging Order ($150 X-Ray) - TEST 3
- [ ] Inpatient Admission ($200) - TEST 4
- [ ] Initial Bed Charge ($500) - TEST 4
- [ ] Medication Administration ($15) - TEST 5
- [ ] Final Bed Charge (varies) - TEST 6

### Payment Tests:
- [ ] Single Payment - TEST 7
- [ ] Multiple Payments - TEST 7
- [ ] Balance Calculation - TEST 7
- [ ] Zero Balance - TEST 7

### Integration Tests:
- [ ] Complete Patient Journey - TEST 8

---

## 🐛 TROUBLESHOOTING

### Issue: No charge created
**Check**:
1. Is the resource (medication/test) configured with a price?
2. Check browser console for errors
3. Check Medplum server logs
4. Verify user has permissions

### Issue: Wrong charge amount
**Check**:
1. Verify pricing configuration in admin
2. Check calculation logic (quantity × price)
3. Verify correct resource was used

### Issue: Bed charge not calculated
**Check**:
1. Verify bed has daily rate set
2. Check encounter location includes bed assignment
3. Verify period.start is set on location

### Issue: Payment not updating balance
**Check**:
1. Verify payment amount entered correctly
2. Check browser console for errors
3. Refresh the billing page

---

## ✅ SUCCESS CRITERIA

**System is working correctly if**:
1. All charge types generate automatically ✅
2. Charge amounts match configured prices ✅
3. Calculations are accurate (quantity × price) ✅
4. Payments reduce balance correctly ✅
5. No console errors during operations ✅
6. Success notifications appear ✅
7. All charges visible in billing page ✅

---

## 📝 TESTING NOTES

Use this space to record your test results:

```
Date: _______________
Tester: _______________

Test 1 (Emergency Visit): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 2 (Lab Order): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 3 (Imaging Order): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 4 (Admission & Bed): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 5 (Medication): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 6 (Discharge): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 7 (Payment): [ ] PASS [ ] FAIL
Notes: _________________________________

Test 8 (Complete Journey): [ ] PASS [ ] FAIL
Notes: _________________________________

Overall Status: [ ] ALL PASS [ ] ISSUES FOUND
```

---

## 🚀 NEXT STEPS AFTER TESTING

### If All Tests Pass:
1. ✅ System is production-ready
2. Configure real-world pricing
3. Train staff on billing workflow
4. Begin using in staging environment

### If Tests Fail:
1. Document specific failures
2. Check console for error messages
3. Review relevant code sections
4. Report issues for debugging

---

**Good luck with testing!** 🎉

Let me know if you encounter any issues and I'll help debug them!


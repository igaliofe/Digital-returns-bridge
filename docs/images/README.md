# מדריך צילומי מסך — `docs/images/`

תיקייה זו מכילה את צילומי המסך שאליהם מפנים מסמכי ההגשה.
**נכון לעכשיו התמונות טרם צולמו** — ההפניות במסמכים הן מצייני מקום (`placeholders`).

## מוסכמות שמות

- שמות הקבצים ב-`kebab-case`, סיומת `.png`.
- מסכי `Web` נושאים את **מזהה הנתיב** (`RouteId`) מתוך
  `e2e/inventory/routes-and-controls.ts` — כדי ששמות התמונות יישארו יציבים
  ותואמים בין מסמכי ההגשה השונים.
- מסכי `Android` נושאים את הקידומת `android-` ואחריה שם ה-`Activity`
  ב-`kebab-case` (למשל `PickupListActivity` ← `android-pickup-list`).
- צילום שממחיש **מצב מיוחד** של מסך קיים נושא את שם המסך ואחריו תיאור המצב
  (למשל `warehouse-receiving-concurrent-error`).

## הנחיות צילום

1. לצלם ברוחב חלון של 1440 פיקסלים לפחות (מסכי `Web`), ובמכשיר / אמולטור
   ברזולוציית `1080x1920` (מסכי `Android`).
2. להשתמש בנתוני הזריעה מ-`database/seed.sql` — לא בנתוני אמת.
3. לוודא שהמסך מכיל תוכן ולא מצב ריק, למעט צילומים שנועדו להדגים מצב ריק.
4. לטשטש או להחליף מספרי טלפון וכתובות אם צולמו נתונים שאינם מהזריעה.

---

## מסכי `Web` (`JSF`)

| שם הקובץ | המסך | הנתיב להגעה | תפקיד מחובר נדרש | מצב נדרש לצילום |
|---|---|---|---|---|
| `login.png` | מסך התחברות | `/login.xhtml` | ללא (מסך פתוח) | טופס ריק, לפני שליחה |
| `dashboard.png` | דשבורד — 8 כרטיסי `KPI` | `/dashboard.xhtml` | `SERVICE_REP` (או `MANAGER`) | קיימות קריאות במספר סטטוסים כדי שהמונים לא יהיו אפס |
| `wizard-step1.png` | אשף שלב 1 — זיהוי לקוח | `/returns/create/identify-customer.xhtml` | `SERVICE_REP` | שדה הטלפון מלא, לפני לחיצה על `Find Customer →` |
| `wizard-step2.png` | אשף שלב 2 — בחירת פריט | `/returns/create/select-item.xhtml` | `SERVICE_REP` | לקוח בעל היסטוריית רכישות שכוללת גם שורת `Available` וגם שורת `Handled` |
| `wizard-step3.png` | אשף שלב 3 — קריאה חדשה | `/returns/create/new-return.xhtml` | `SERVICE_REP` | הטופס ממולא, כולל חתימה על משטח החתימה |
| `returns-list.png` | רשימת קריאות ההחזרה | `/returns/list.xhtml` | `SERVICE_REP` / `MANAGER` | סרגל הסינון פתוח וטבלה עם שורות במספר סטטוסים, כולל שורה אחת עם `Not assigned` |
| `return-details.png` | פרטי קריאה | `/returns/details.xhtml?id=<מזהה>` | `SERVICE_REP` / `MANAGER` | קריאה מתקדמת שיש לה ברקוד, תמונות והיסטוריית סטטוסים בת מספר שורות |
| `warehouse-receiving.png` | קליטת מחסן — התיק הדיגיטלי | `/warehouse/receiving.xhtml` | `WAREHOUSE` | לאחר חיפוש ברקוד מוצלח, על קריאה בסטטוס `ARRIVED_TO_WAREHOUSE` כדי שגם טופס הבדיקה יופיע |
| `warehouse-receiving-concurrent-error.png` | הודעת התנגשות עריכה | `/warehouse/receiving.xhtml` | `WAREHOUSE` | לפתוח את אותה קריאה בשני דפדפנים, לעדכן באחד ואז לפעול בשני — עד להופעת ההודעה `הרשומה עודכנה על ידי משתמש אחר. רענן את הדף ונסה שוב` |
| `reports.png` | דוחות ו-`KPI` | `/reports.xhtml` | `MANAGER` | קיימים נתונים בכל ארבעת הפאנלים, אחרת הם אינם מרונדרים כלל |
| `admin-users.png` | ניהול משתמשים | `/admin/users.xhtml` | `MANAGER` | הטבלה מלאה; רצוי לצלם עם שורה אחת במצב עריכה |
| `admin-customers.png` | ניהול לקוחות | `/admin/customers.xhtml` | `MANAGER` | הטבלה מלאה |
| `admin-products.png` | ניהול מוצרים | `/admin/products.xhtml` | `MANAGER` | הטבלה מלאה, כולל עמודת `Image` עם תמונות קטלוג |
| `admin-drivers.png` | ניהול נהגים | `/admin/drivers.xhtml` | `MANAGER` | הטבלה מלאה; רצוי לצלם עם חלון `Create New Driver` פתוח כדי להראות את בורר המשתמש |

**הערה על ההרשאות:** `RoleAuthFilter` אוכף כיום רק **התחברות**, לא תפקיד, וסרגל הניווט מציג את כל הקישורים לכל משתמש מחובר. עמודת "תפקיד מחובר נדרש" מציינת את התפקיד שאמור תפעולית לעבוד במסך — לא מגבלה טכנית.

---

## מסכי `Android`

| שם הקובץ | המסך | ה-`Activity` | תפקיד מחובר נדרש | מצב נדרש לצילום |
|---|---|---|---|---|
| `android-login.png` | התחברות באפליקציה | `LoginActivity` | ללא | שדה הטלפון מלא, לפני `Login` |
| `android-pickup-list.png` | רשימת האיסופים של הנהג | `PickupListActivity` | `DRIVER` | לנהג מוקצות לפחות שלוש קריאות, מהן אחת עם ברקוד ואחת בלי |
| `android-pickup-details.png` | פרטי איסוף | `PickupDetailsActivity` | `DRIVER` | קריאה עם תמונת קטלוג; רצוי לפני שיוך ברקוד, כדי שתופיע הנחיית השיוך |
| `android-barcode-assignment.png` | שיוך ברקוד | `BarcodeAssignmentActivity` | `DRIVER` | המסך עם הנחיות הדבקת המדבקה ושדה הברקוד הריק |
| `android-image-capture.png` | צילום תמונות | `ImageCaptureActivity` | `DRIVER` | לאחר צילום, כשהתצוגה המקדימה מלאה ובוחר סוג התמונה על `Defect` |
| `android-pickup-confirmation.png` | אישור איסוף וחתימה | `PickupConfirmationActivity` | `DRIVER` | הטופס ממולא וחתימה על המשטח; הקריאה בסטטוס `BARCODE_ASSIGNED` עם תמונה, כדי שכפתור האישור יהיה פעיל |
| `android-storekeeper-home.png` | תור העבודה של המחסנאי | `StorekeeperHomeActivity` | `WAREHOUSE` | התור מכיל גם פריטי `PICKED_UP` וגם `ARRIVED_TO_WAREHOUSE` |
| `android-warehouse-scan.png` | סריקת ברקוד במחסן | `WarehouseScanActivity` | `WAREHOUSE` | המסך עם ההנחיה וכפתור `Open Scanner`, לפני סריקה |
| `android-warehouse-return-details.png` | תיק ההחזרה | `WarehouseReturnDetailsActivity` | `WAREHOUSE` | קריאה בסטטוס `PICKED_UP`, כדי ש-`Mark as Arrived` יהיה פעיל |
| `android-warehouse-inspection.png` | בדיקת מחסן והחלטה | `WarehouseInspectionActivity` | `WAREHOUSE` | קריאה בסטטוס `ARRIVED_TO_WAREHOUSE`, עם תמונות שירות ותמונות פגם של הנהג, כדי שכל הקטעים יוצגו |

---

## סיכום — 24 צילומים

14 מסכי `Web` (13 מסכים + מצב שגיאה אחד) + 10 מסכי `Android`.

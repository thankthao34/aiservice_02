const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads', 'products');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `product_${req.params.id}_${Date.now()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      cb(new Error('Only jpg/png/webp images are allowed'));
      return;
    }
    cb(null, true);
  }
});

const productController = require('./api/controllers/productController');
const productValidators = require('./api/validators/productValidators');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./api/openapi.json');
const ProductService = require('./application/productService');
const SqliteProductRepository = require('./infrastructure/sqliteProductRepository');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
const productRepository = new SqliteProductRepository('./db/products.db');
const productService = new ProductService(productRepository);
productController.setService(productService);

const PRODUCT_TAXONOMY = [
  {
    key: 'electronics',
    label: 'Electronics',
    subcategories: [
      { key: 'phone', label: 'Phone' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'laptop', label: 'Laptop' },
      { key: 'tablet', label: 'Tablet' },
      { key: 'audio', label: 'Audio' },
      { key: 'wearable', label: 'Wearable' },
      { key: 'gaming', label: 'Gaming' },
      { key: 'networking', label: 'Networking' },
      { key: 'storage', label: 'Storage' },
      { key: 'smart-home', label: 'Smart Home' },
      { key: 'camera', label: 'Camera' },
      { key: 'monitor', label: 'Monitor' },
      { key: 'accessory', label: 'Accessory' }
    ]
  },
  {
    key: 'fashion',
    label: 'Fashion',
    subcategories: [
      { key: 'ao', label: 'Ao' },
      { key: 'quan', label: 'Quan' },
      { key: 'giay-dep', label: 'Giay dep' },
      { key: 'tui-xach', label: 'Tui xach' },
      { key: 'phu-kien-thoi-trang', label: 'Phu kien thoi trang' }
    ]
  },
  {
    key: 'beauty',
    label: 'My pham',
    subcategories: [
      { key: 'son-moi', label: 'Son moi' },
      { key: 'kem-nen', label: 'Kem nen' },
      { key: 'cham-soc-da', label: 'Cham soc da' },
      { key: 'nuoc-hoa', label: 'Nuoc hoa' }
    ]
  },
  {
    key: 'home-living',
    label: 'Nha cua doi song',
    subcategories: [
      { key: 'do-bep', label: 'Do bep' },
      { key: 'noi-that', label: 'Noi that' },
      { key: 'trang-tri-nha', label: 'Trang tri nha' },
      { key: 'gia-dung', label: 'Gia dung' }
    ]
  },
  {
    key: 'appliances',
    label: 'Dien lanh dien gia dung',
    subcategories: [
      { key: 'dieu-hoa', label: 'Dieu hoa' },
      { key: 'tu-lanh', label: 'Tu lanh' },
      { key: 'may-giat', label: 'May giat' },
      { key: 'may-loc-khong-khi', label: 'May loc khong khi' }
    ]
  },
  {
    key: 'mom-baby',
    label: 'Me va be',
    subcategories: [
      { key: 'ta-bim', label: 'Ta bim' },
      { key: 'do-so-sinh', label: 'Do so sinh' },
      { key: 'sua-bot', label: 'Sua bot' }
    ]
  },
  {
    key: 'sports-outdoor',
    label: 'The thao du lich',
    subcategories: [
      { key: 'gym-fitness', label: 'Gym fitness' },
      { key: 'the-thao-ngoai-troi', label: 'The thao ngoai troi' },
      { key: 'phu-kien-du-lich', label: 'Phu kien du lich' }
    ]
  },
  {
    key: 'books-stationery',
    label: 'Sach van phong pham',
    subcategories: [
      { key: 'sach', label: 'Sach' },
      { key: 'van-phong-pham', label: 'Van phong pham' },
      { key: 'qua-luu-niem', label: 'Qua luu niem' }
    ]
  },
  {
    key: 'grocery',
    label: 'Bach hoa',
    subcategories: [
      { key: 'thuc-pham-kho', label: 'Thuc pham kho' },
      { key: 'do-uong', label: 'Do uong' },
      { key: 'do-an-vat', label: 'Do an vat' }
    ]
  },
  {
    key: 'pet-care',
    label: 'Cham soc thu cung',
    subcategories: [
      { key: 'thuc-an-thu-cung', label: 'Thuc an thu cung' },
      { key: 'phu-kien-thu-cung', label: 'Phu kien thu cung' }
    ]
  },
  {
    key: 'automotive',
    label: 'O to xe may',
    subcategories: [
      { key: 'phu-kien-xe', label: 'Phu kien xe' },
      { key: 'cham-soc-xe', label: 'Cham soc xe' }
    ]
  },
  {
    key: 'office-supplies',
    label: 'Van phong',
    subcategories: [
      { key: 'office', label: 'Office' },
      { key: 'ban-phim', label: 'Ban phim' },
      { key: 'chuot', label: 'Chuot' }
    ]
  }
];

const SUBCATEGORY_INDEX = new Map();
for (const main of PRODUCT_TAXONOMY) {
  for (const sub of main.subcategories) {
    SUBCATEGORY_INDEX.set(sub.key, {
      mainKey: main.key,
      mainLabel: main.label,
      subLabel: sub.label
    });
  }
}

const SUBCATEGORY_MAIN_MAP = Array.from(SUBCATEGORY_INDEX.entries()).reduce((accumulator, [subKey, meta]) => {
  accumulator[subKey] = meta.mainKey;
  return accumulator;
}, {});

const CATEGORIES = Array.from(SUBCATEGORY_INDEX.keys());

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function resolveCategoryInput(rawMainCategory, rawSubCategory, fallbackCategory) {
  const subCategory = normalizeKey(rawSubCategory || fallbackCategory);
  if (!subCategory) {
    return { error: 'Missing sub category' };
  }

  const subInfo = SUBCATEGORY_INDEX.get(subCategory);
  if (!subInfo) {
    return { error: 'Invalid sub category' };
  }

  const mainCategory = normalizeKey(rawMainCategory);
  if (mainCategory && mainCategory !== subInfo.mainKey) {
    return { error: 'Sub category does not belong to selected main category' };
  }

  return {
    mainCategory: subInfo.mainKey,
    subCategory
  };
}

function categoryMetaFromRow(row) {
  const subCategory = normalizeKey(row.sub_category || row.category);
  const subInfo = SUBCATEGORY_INDEX.get(subCategory) || null;
  return {
    mainCategory: subInfo?.mainKey || normalizeKey(row.main_category) || 'electronics',
    subCategory,
    mainCategoryLabel: subInfo?.mainLabel || row.main_category || 'electronics',
    subCategoryLabel: subInfo?.subLabel || subCategory
  };
}

const SEARCH_MAIN_CATEGORY_KEYWORDS = {
  electronics: ['cong nghe', 'electronics', 'dien tu', 'do dien tu'],
  fashion: ['thoi trang', 'fashion', 'ao', 'quan', 'giay dep'],
  beauty: ['my pham', 'lam dep', 'beauty', 'son moi', 'kem nen'],
  'home-living': ['nha cua', 'noi that', 'gia dung', 'home living'],
  appliances: ['dien lanh', 'dieu hoa', 'tu lanh', 'may giat'],
  'mom-baby': ['me va be', 'me be', 'so sinh', 'ta bim'],
  'sports-outdoor': ['the thao', 'du lich', 'outdoor'],
  'books-stationery': ['sach', 'van phong pham', 'truyen', 'stationery', 'book'],
  grocery: ['bach hoa', 'do uong', 'thuc pham'],
  'pet-care': ['thu cung', 'pet'],
  automotive: ['o to', 'xe may', 'phu kien xe'],
  'office-supplies': ['van phong', 'office supply', 'office']
};

const SEARCH_SUBCATEGORY_KEYWORDS = {
  laptop: ['laptop', 'macbook', 'notebook'],
  phone: ['dien thoai', 'phone', 'iphone', 'samsung', 'pixel', 'realme', 'xiaomi'],
  mobile: ['mobile'],
  tablet: ['tablet', 'ipad'],
  audio: ['tai nghe', 'headphone', 'earbuds', 'loa', 'speaker'],
  monitor: ['monitor', 'man hinh'],
  camera: ['camera', 'may anh'],
  storage: ['ssd', 'nvme', 'hdd', 'o cung', 'luu tru'],
  networking: ['router', 'wifi', 'mesh'],
  accessory: ['phu kien', 'chuot', 'mouse', 'ban phim', 'keyboard', 'charger', 'sac', 'webcam', 'hub', 'cable'],
  ao: ['ao thun', 'ao so mi', 'ao khoac', 'ao'],
  quan: ['quan jeans', 'quan tay', 'quan short', 'quan'],
  'giay-dep': ['giay', 'dep', 'sneaker'],
  'tui-xach': ['tui xach', 'tui deo', 'balo', 'vi'],
  'phu-kien-thoi-trang': ['that lung', 'mu non', 'kinh mat', 'phu kien thoi trang'],
  'son-moi': ['son', 'son moi', 'lipstick', 'lip tint'],
  'kem-nen': ['kem nen', 'foundation', 'cushion'],
  'cham-soc-da': ['serum', 'sua rua mat', 'duong am', 'cham soc da', 'skincare'],
  'nuoc-hoa': ['nuoc hoa', 'perfume', 'mui huong'],
  'do-bep': ['do bep', 'noi', 'chao', 'dao', 'thot'],
  'noi-that': ['noi that', 'ban ghe', 'tu ke'],
  'trang-tri-nha': ['trang tri nha', 'decor', 'den trang tri'],
  'gia-dung': ['gia dung', 'am sieu toc', 'ban ui', 'may hut bui'],
  'dieu-hoa': ['dieu hoa', 'may lanh'],
  'tu-lanh': ['tu lanh'],
  'may-giat': ['may giat'],
  'may-loc-khong-khi': ['may loc khong khi', 'air purifier'],
  'ta-bim': ['ta bim', 'bim', 'ta'],
  'do-so-sinh': ['do so sinh', 'quan ao so sinh'],
  'sua-bot': ['sua bot', 'sua cong thuc'],
  'gym-fitness': ['gym', 'fitness', 'tap ta', 'yoga'],
  'the-thao-ngoai-troi': ['the thao ngoai troi', 'bong da', 'cau long', 'chay bo'],
  'phu-kien-du-lich': ['vali', 'balo du lich', 'phu kien du lich'],
  sach: ['sach', 'truyen'],
  'van-phong-pham': ['vo', 'but', 'so tay', 'van phong pham'],
  'qua-luu-niem': ['qua luu niem', 'gift'],
  'thuc-pham-kho': ['gao', 'mi', 'thuc pham kho'],
  'do-uong': ['nuoc ngot', 'tra', 'ca phe', 'do uong'],
  'do-an-vat': ['banh snack', 'do an vat'],
  'thuc-an-thu-cung': ['thuc an thu cung', 'hat cho', 'pate meo'],
  'phu-kien-thu-cung': ['vong co', 'day dat', 'cat ve sinh', 'phu kien thu cung'],
  'phu-kien-xe': ['phu kien xe', 'dash cam', 'gia do dien thoai xe'],
  'cham-soc-xe': ['cham soc xe', 'rua xe', 'bao duong xe'],
  office: ['van phong', 'office'],
  'ban-phim': ['ban phim', 'keyboard'],
  chuot: ['chuot', 'mouse']
};

function resolveSearchIntent(rawSearch) {
  const text = normalizeText(rawSearch);
  if (!text) return null;

  let subCategory = null;
  let mainCategory = null;

  for (const [subKey, keywords] of Object.entries(SEARCH_SUBCATEGORY_KEYWORDS)) {
    const normalizedSub = normalizeText(subKey.replace(/-/g, ' '));
    if (text === normalizedSub || text.includes(normalizedSub) || keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      subCategory = subKey;
      break;
    }
  }

  if (subCategory) {
    mainCategory = SUBCATEGORY_MAIN_MAP[subCategory] || null;
  }

  for (const [mainKey, keywords] of Object.entries(SEARCH_MAIN_CATEGORY_KEYWORDS)) {
    const normalizedMain = normalizeText(mainKey.replace(/-/g, ' '));
    if (text === normalizedMain || text.includes(normalizedMain) || keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      mainCategory = mainKey;
      break;
    }
  }

  if (!mainCategory && subCategory) {
    mainCategory = SUBCATEGORY_MAIN_MAP[subCategory] || null;
  }

  if (!mainCategory && !subCategory) return null;

  return { mainCategory, subCategory };
}

const categoryImages = {
  phone: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?auto=format&fit=crop&w=1200&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80',
  tablet: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80',
  audio: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
  wearable: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=1200&q=80',
  gaming: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
  networking: 'https://images.unsplash.com/photo-1647427060118-4911c9821b82?auto=format&fit=crop&w=1200&q=80',
  storage: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80',
  'smart-home': 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=80',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
  accessory: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=80',
  office: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80'
};

const mainCategoryImages = {
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  fashion: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80',
  beauty: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
  'home-living': 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80',
  appliances: 'https://images.unsplash.com/photo-1586208958839-06c17cacdf08?auto=format&fit=crop&w=1200&q=80',
  'mom-baby': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80',
  'sports-outdoor': 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  'books-stationery': 'https://images.unsplash.com/photo-1491841651911-c44c30c34548?auto=format&fit=crop&w=1200&q=80',
  grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
  'pet-care': 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
  automotive: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
  'office-supplies': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80'
};

function getCategoryImage(mainCategory, subCategory) {
  return categoryImages[subCategory] || mainCategoryImages[mainCategory] || categoryImages.accessory;
}

const NICHE_MAIN_TARGET = {
  fashion: 12,
  beauty: 11,
  'home-living': 10,
  appliances: 10,
  'mom-baby': 10,
  'sports-outdoor': 10,
  'books-stationery': 10,
  grocery: 10,
  'pet-care': 10,
  automotive: 10,
  'office-supplies': 12
};

const SUBCATEGORY_SEED_RECIPES = {
  ao: {
    brands: ['Routine', 'Canifa', 'Yody', 'Coolmate'],
    patterns: ['{brand} Oxford Shirt', '{brand} Polo Air', '{brand} Tee Cotton 220GSM'],
    variants: ['Slim Fit', 'Regular Fit', 'Oversize'],
    minPrice: 16,
    stepPrice: 3,
    warranty: 6,
    desc: 'Ao thoi trang de mac, chat vai thoang va giu form tot.'
  },
  quan: {
    brands: ['Coolmate', 'Levents', 'Routine', 'Yody'],
    patterns: ['{brand} Chino Pants', '{brand} Denim Straight', '{brand} Jogger DryTech'],
    variants: ['Form Basic', 'Form Loose', 'Form Slim'],
    minPrice: 20,
    stepPrice: 4,
    warranty: 6,
    desc: 'Quan mac di hoc, di lam, de phoi do va ben vai.'
  },
  'giay-dep': {
    brands: ['Nike', 'Adidas', 'Vans', 'Converse'],
    patterns: ['{brand} Sneaker Court', '{brand} Running Lite', '{brand} Sandal Comfort'],
    variants: ['Size 39-43', 'Unisex', 'Daily Wear'],
    minPrice: 34,
    stepPrice: 8,
    warranty: 12,
    desc: 'Giay dep em chan, de di lai va phu hop nhieu phong cach.'
  },
  'tui-xach': {
    brands: ['Pedro', 'Charles Keith', 'Evergoods', 'Tucano'],
    patterns: ['{brand} Tote Bag', '{brand} Crossbody', '{brand} Mini Backpack'],
    variants: ['Black Edition', 'Brown Edition', 'Waterproof'],
    minPrice: 28,
    stepPrice: 7,
    warranty: 12,
    desc: 'Tui xach gon dep, ngan chua hop ly, phu hop di hoc di lam.'
  },
  'phu-kien-thoi-trang': {
    brands: ['Fossil', 'Casio', 'MLB', 'Uniqlo'],
    patterns: ['{brand} Leather Belt', '{brand} Bucket Hat', '{brand} Classic Cap'],
    variants: ['Core', 'Street', 'Essential'],
    minPrice: 12,
    stepPrice: 3,
    warranty: 6,
    desc: 'Phu kien thoi trang de mix do va tao diem nhan.'
  },
  'son-moi': {
    brands: ['Romand', '3CE', 'Bbia', 'Maybelline'],
    patterns: ['{brand} Velvet Tint', '{brand} Matte Lip Cream', '{brand} Glow Lip Balm'],
    variants: ['Mau Do Dat', 'Mau Nude Dao', 'Mau Hong Tra'],
    minPrice: 9,
    stepPrice: 2,
    warranty: 12,
    desc: 'Son moi len mau dep, mem moi va ben mau hang ngay.'
  },
  'kem-nen': {
    brands: ['L Oreal', 'Maybelline', 'Laneige', 'Espoir'],
    patterns: ['{brand} Skin Fit Foundation', '{brand} Matte Cover', '{brand} Glow Base'],
    variants: ['SPF 30', 'SPF 50', 'Oil Control'],
    minPrice: 14,
    stepPrice: 3,
    warranty: 12,
    desc: 'Kem nen de tan, che phu on va giu nen lau troi.'
  },
  'cham-soc-da': {
    brands: ['La Roche Posay', 'CeraVe', 'Hada Labo', 'Some By Mi'],
    patterns: ['{brand} Cleanser', '{brand} Moisturizer', '{brand} Serum B5'],
    variants: ['For Oily Skin', 'For Dry Skin', 'Sensitive Skin'],
    minPrice: 11,
    stepPrice: 3,
    warranty: 12,
    desc: 'Cham soc da diu nhe, phu hop routine sang toi.'
  },
  'nuoc-hoa': {
    brands: ['Calvin Klein', 'Davidoff', 'Versace', 'Armaf'],
    patterns: ['{brand} Eau De Parfum', '{brand} Fresh EDT', '{brand} Night Scent'],
    variants: ['50ml', '75ml', '100ml'],
    minPrice: 24,
    stepPrice: 8,
    warranty: 12,
    desc: 'Nuoc hoa mui huong de chiu, do luu huong tot.'
  },
  'do-bep': {
    brands: ['LocknLock', 'Sunhouse', 'Elmich', 'Tefal'],
    patterns: ['{brand} Non Stick Pan', '{brand} Knife Set', '{brand} Glass Container'],
    variants: ['3 pcs', '5 pcs', 'Heat Resistant'],
    minPrice: 18,
    stepPrice: 6,
    warranty: 12,
    desc: 'Do bep ben dep, de ve sinh va an toan khi nau nuong.'
  },
  'noi-that': {
    brands: ['Ikea', 'Jysk', 'Hobro', 'Uma'],
    patterns: ['{brand} Work Desk', '{brand} Lounge Chair', '{brand} Storage Shelf'],
    variants: ['Walnut', 'Oak', 'Minimal'],
    minPrice: 72,
    stepPrice: 18,
    warranty: 24,
    desc: 'Noi that gon gang, toi uu khong gian va de lap dat.'
  },
  'trang-tri-nha': {
    brands: ['Ikea', 'Xiaomi', 'Philips', 'Lumi'],
    patterns: ['{brand} LED String Light', '{brand} Aroma Diffuser', '{brand} Decor Frame'],
    variants: ['Warm White', 'Smart App', 'Modern'],
    minPrice: 12,
    stepPrice: 5,
    warranty: 12,
    desc: 'Trang tri nha tao cam giac am cung va hien dai.'
  },
  'gia-dung': {
    brands: ['Panasonic', 'Philips', 'Sunhouse', 'Xiaomi'],
    patterns: ['{brand} Vacuum Cleaner', '{brand} Steam Iron', '{brand} Electric Kettle'],
    variants: ['Compact', 'Family Size', 'Fast Heat'],
    minPrice: 28,
    stepPrice: 9,
    warranty: 18,
    desc: 'Gia dung thiet thuc giup viec nha nhe nhang hon.'
  },
  'dieu-hoa': {
    brands: ['Daikin', 'Panasonic', 'LG', 'Samsung'],
    patterns: ['{brand} Inverter AC 1HP', '{brand} Inverter AC 1.5HP', '{brand} Smart AC'],
    variants: ['Energy Save', 'WiFi Control', 'Quiet Mode'],
    minPrice: 320,
    stepPrice: 40,
    warranty: 24,
    desc: 'Dieu hoa tiet kiem dien, lam lanh nhanh va on dinh.'
  },
  'tu-lanh': {
    brands: ['Samsung', 'LG', 'Aqua', 'Panasonic'],
    patterns: ['{brand} Fridge 250L', '{brand} Fridge 300L', '{brand} Side by Side'],
    variants: ['Inverter', 'Multi Airflow', 'Hygiene Fresh'],
    minPrice: 360,
    stepPrice: 55,
    warranty: 24,
    desc: 'Tu lanh luu tru rong rai, lam lanh sau va em ai.'
  },
  'may-giat': {
    brands: ['LG', 'Samsung', 'Toshiba', 'Electrolux'],
    patterns: ['{brand} Washer 9kg', '{brand} Washer 10kg', '{brand} Washer Dryer'],
    variants: ['AI Wash', 'Steam Care', 'Quick Wash'],
    minPrice: 340,
    stepPrice: 50,
    warranty: 24,
    desc: 'May giat ben, van hanh em va tiet kiem dien nuoc.'
  },
  'may-loc-khong-khi': {
    brands: ['Sharp', 'Xiaomi', 'Coway', 'Philips'],
    patterns: ['{brand} Air Purifier', '{brand} HEPA Purifier', '{brand} Smart Purifier'],
    variants: ['For 20m2', 'For 35m2', 'PM2.5 Sensor'],
    minPrice: 180,
    stepPrice: 26,
    warranty: 24,
    desc: 'May loc khong khi hoat dong on dinh, cai thien chat luong khong khi.'
  },
  'ta-bim': {
    brands: ['Huggies', 'Pampers', 'Merries', 'Bobby'],
    patterns: ['{brand} Diaper Pants', '{brand} Tape Diaper', '{brand} Premium Dry'],
    variants: ['Size M', 'Size L', 'Size XL'],
    minPrice: 14,
    stepPrice: 3,
    warranty: 6,
    desc: 'Ta bim mem mai, thấm hut tot va giu be kho thoang.'
  },
  'do-so-sinh': {
    brands: ['Pigeon', 'Chicco', 'Moony', 'Avent'],
    patterns: ['{brand} Newborn Set', '{brand} Feeding Bottle Set', '{brand} Baby Blanket'],
    variants: ['0-6 months', '6-12 months', 'Cotton Soft'],
    minPrice: 12,
    stepPrice: 4,
    warranty: 12,
    desc: 'Do so sinh an toan, chat lieu than thien voi be.'
  },
  'sua-bot': {
    brands: ['Aptamil', 'Nan', 'Meiji', 'Friso'],
    patterns: ['{brand} Stage 1', '{brand} Stage 2', '{brand} Grow Plus'],
    variants: ['400g', '800g', '900g'],
    minPrice: 18,
    stepPrice: 5,
    warranty: 12,
    desc: 'Sua bot bo sung duong chat, phu hop tung giai doan phat trien.'
  },
  'gym-fitness': {
    brands: ['Adidas', 'Nike', 'Decathlon', 'Kingsport'],
    patterns: ['{brand} Yoga Mat', '{brand} Resistance Band Set', '{brand} Dumbbell Pair'],
    variants: ['Beginner', 'Home Gym', 'Pro'],
    minPrice: 15,
    stepPrice: 6,
    warranty: 12,
    desc: 'Dung cu gym fitness cho tap tai nha va phong gym.'
  },
  'the-thao-ngoai-troi': {
    brands: ['Naturehike', 'Coleman', 'Decathlon', 'Fornix'],
    patterns: ['{brand} Camping Tent', '{brand} Trekking Pole', '{brand} Sports Bottle'],
    variants: ['2 Persons', '4 Persons', 'Lightweight'],
    minPrice: 22,
    stepPrice: 9,
    warranty: 12,
    desc: 'Thiet bi ngoai troi gon nhe, de mang theo va ben bi.'
  },
  'phu-kien-du-lich': {
    brands: ['Xiaomi', 'Anker', 'Naturehike', 'Travelmate'],
    patterns: ['{brand} Travel Adapter', '{brand} Neck Pillow', '{brand} Packing Cube Set'],
    variants: ['Universal', 'Memory Foam', '3 pcs'],
    minPrice: 10,
    stepPrice: 5,
    warranty: 12,
    desc: 'Phu kien du lich giup hanh trinh gon gon va tien loi hon.'
  },
  sach: {
    brands: ['Nha Nam', 'Kim Dong', 'Tre', 'Alpha Books'],
    patterns: ['{brand} Sach Ky Nang Song', '{brand} Sach Kinh Doanh', '{brand} Tieu Thuyet Bestseller'],
    variants: ['Tap 1', 'Tap 2', 'Ban Moi'],
    minPrice: 4,
    stepPrice: 2,
    warranty: 6,
    desc: 'Sach in ro dep, noi dung huu ich cho hoc tap va giai tri.'
  },
  'van-phong-pham': {
    brands: ['Thien Long', 'Deli', 'Plus', 'Pentel'],
    patterns: ['{brand} Gel Pen Box', '{brand} Notebook A5', '{brand} Sticky Note Set'],
    variants: ['Blue Ink', 'Black Ink', 'Multicolor'],
    minPrice: 3,
    stepPrice: 1.5,
    warranty: 6,
    desc: 'Van phong pham co ban cho hoc tap va lam viec hang ngay.'
  },
  'qua-luu-niem': {
    brands: ['Moleskine', 'Lamy', 'Miniso', 'Deli'],
    patterns: ['{brand} Gift Set', '{brand} Souvenir Box', '{brand} Creative Notebook'],
    variants: ['Classic', 'Limited', 'Collector'],
    minPrice: 6,
    stepPrice: 3,
    warranty: 6,
    desc: 'Qua luu niem gon dep, phu hop tang ban be va dong nghiep.'
  },
  'thuc-pham-kho': {
    brands: ['AnAn', 'Simply', 'Ajinomoto', 'Orion'],
    patterns: ['{brand} Instant Noodle Pack', '{brand} Oatmeal Box', '{brand} Cereal Granola'],
    variants: ['Family Pack', '500g', '1kg'],
    minPrice: 3,
    stepPrice: 1.5,
    warranty: 6,
    desc: 'Thuc pham kho de bao quan, tien loi cho bua an nhanh.'
  },
  'do-uong': {
    brands: ['Vinamilk', 'TH True Milk', 'Pepsi', 'Coca Cola'],
    patterns: ['{brand} Fresh Milk', '{brand} Sparkling Drink', '{brand} Fruit Juice'],
    variants: ['330ml', '1L', 'Thung 24 lon'],
    minPrice: 2,
    stepPrice: 1.2,
    warranty: 6,
    desc: 'Do uong de dung, phu hop gia dinh va van phong.'
  },
  'do-an-vat': {
    brands: ['Orion', 'Oishi', 'Lay s', 'Poca'],
    patterns: ['{brand} Potato Chips', '{brand} Biscuit Mix', '{brand} Rice Cracker'],
    variants: ['75g', '120g', 'Family Size'],
    minPrice: 2.5,
    stepPrice: 1.4,
    warranty: 6,
    desc: 'Do an vat ngon mieng, tien cho xem phim va di choi.'
  },
  'thuc-an-thu-cung': {
    brands: ['Royal Canin', 'SmartHeart', 'Whiskas', 'Pedigree'],
    patterns: ['{brand} Dry Food', '{brand} Wet Food', '{brand} Grain Free Formula'],
    variants: ['Cat Adult', 'Dog Puppy', '1.5kg'],
    minPrice: 8,
    stepPrice: 3,
    warranty: 12,
    desc: 'Thuc an thu cung bo sung duong chat, de tieu hoa.'
  },
  'phu-kien-thu-cung': {
    brands: ['Pawise', 'Petkit', 'Ferplast', 'DoggyMan'],
    patterns: ['{brand} Pet Leash', '{brand} Smart Feeder', '{brand} Cat Litter Box'],
    variants: ['M size', 'L size', 'Auto Mode'],
    minPrice: 10,
    stepPrice: 4,
    warranty: 12,
    desc: 'Phu kien thu cung giup cham soc thu cung de dang hon.'
  },
  'phu-kien-xe': {
    brands: ['3M', 'Michelin', 'Xiaomi', 'Baseus'],
    patterns: ['{brand} Car Holder', '{brand} Tire Inflator', '{brand} Dash Cam'],
    variants: ['12V', 'Wireless', '1080P'],
    minPrice: 12,
    stepPrice: 6,
    warranty: 12,
    desc: 'Phu kien xe hoi huu ich, de lap dat va ben bi.'
  },
  'cham-soc-xe': {
    brands: ['Sonax', 'Turtle Wax', 'Liqui Moly', 'Shell'],
    patterns: ['{brand} Car Shampoo', '{brand} Engine Oil', '{brand} Interior Cleaner'],
    variants: ['1L', '4L', 'Premium'],
    minPrice: 14,
    stepPrice: 7,
    warranty: 12,
    desc: 'San pham cham soc xe giup giu xe sach va van hanh tot.'
  },
  office: {
    brands: ['Logitech', 'Dell', 'Anker', 'Ugreen'],
    patterns: ['{brand} Desk Lamp', '{brand} USB Hub', '{brand} Laptop Stand'],
    variants: ['Ergonomic', 'Aluminum', 'Adjustable'],
    minPrice: 18,
    stepPrice: 6,
    warranty: 12,
    desc: 'Do dung van phong ho tro setup ban lam viec gon gang.'
  },
  'ban-phim': {
    brands: ['Logitech', 'Keychron', 'Akko', 'Rapoo'],
    patterns: ['{brand} Mechanical Keyboard', '{brand} Wireless Keyboard', '{brand} Office Keyboard'],
    variants: ['Red Switch', 'Brown Switch', 'Silent'],
    minPrice: 32,
    stepPrice: 9,
    warranty: 12,
    desc: 'Ban phim go suong tay, phu hop code va van phong.'
  },
  chuot: {
    brands: ['Logitech', 'Razer', 'Rapoo', 'Microsoft'],
    patterns: ['{brand} Wireless Mouse', '{brand} Ergonomic Mouse', '{brand} Productivity Mouse'],
    variants: ['Silent Click', 'Bluetooth', '1600 DPI'],
    minPrice: 16,
    stepPrice: 5,
    warranty: 12,
    desc: 'Chuot de cam nam, tracking on dinh, dung lau khong moi.'
  }
};

function buildNicheSeedCatalog() {
  const generated = [];

  for (const [mainCategory, targetCount] of Object.entries(NICHE_MAIN_TARGET)) {
    const subKeys = PRODUCT_TAXONOMY.find((x) => x.key === mainCategory)?.subcategories?.map((x) => x.key) || [];
    if (!subKeys.length) {
      continue;
    }

    for (let i = 0; i < targetCount; i += 1) {
      const subKey = subKeys[i % subKeys.length];
      const recipe = SUBCATEGORY_SEED_RECIPES[subKey];
      if (!recipe) {
        continue;
      }

      const brand = recipe.brands[i % recipe.brands.length];
      const pattern = recipe.patterns[i % recipe.patterns.length].replace('{brand}', brand);
      const variant = recipe.variants[i % recipe.variants.length];
      const sku = `${subKey.toUpperCase().slice(0, 3)}-${200 + i}`;

      generated.push({
        name: `${pattern} ${variant} ${sku}`,
        main_category: mainCategory,
        sub_category: subKey,
        category: subKey,
        price: Number((recipe.minPrice + (i * recipe.stepPrice)).toFixed(2)),
        stock: 35 + ((i * 13) % 80),
        rating: Number((4.1 + ((i % 7) * 0.1)).toFixed(1)),
        is_featured: i < 2 ? 1 : 0,
        description: recipe.desc,
        brand,
        warranty_months: recipe.warranty
      });
    }
  }

  return generated;
}

const seedCatalog = [
  { name: 'iPhone 15 Pro Max', category: 'phone', price: 1199, stock: 42, rating: 4.8, is_featured: 1, description: 'Flagship Apple, camera quay chup dang cap, hieu nang manh, ho tro eSIM.', brand: 'Apple', warranty_months: 12 },
  { name: 'Galaxy S24 Ultra', category: 'phone', price: 1249, stock: 38, rating: 4.8, is_featured: 1, description: 'Camera zoom xa, man hinh QHD+, pin ben, S Pen tich hop.', brand: 'Samsung', warranty_months: 12 },
  { name: 'MacBook Air M3', category: 'laptop', price: 1499, stock: 25, rating: 4.9, is_featured: 1, description: 'Laptop sieu nhe, pin lau, chip M3 toi uu cho hoc tap va cong viec.', brand: 'Apple', warranty_months: 12 },
  { name: 'Dell XPS 14', category: 'laptop', price: 1699, stock: 18, rating: 4.7, is_featured: 1, description: 'Laptop premium, man hinh dep, phu hop creator va doanh nhan.', brand: 'Dell', warranty_months: 24 },
  { name: 'iPad Air Gen 6', category: 'tablet', price: 699, stock: 44, rating: 4.6, is_featured: 0, description: 'May tinh bang man dep, hieu nang tot cho note va giai tri.', brand: 'Apple', warranty_months: 12 },
  { name: 'Galaxy Tab S9', category: 'tablet', price: 749, stock: 30, rating: 4.6, is_featured: 0, description: 'Tablet Android cao cap, man hinh dep, phu hop lam viec di dong.', brand: 'Samsung', warranty_months: 12 },
  { name: 'Sony WH-1000XM5', category: 'audio', price: 349, stock: 70, rating: 4.8, is_featured: 1, description: 'Tai nghe chong on top dau, am thanh can bang, pin ben.', brand: 'Sony', warranty_months: 12 },
  { name: 'JBL Live Pro 2', category: 'audio', price: 139, stock: 96, rating: 4.4, is_featured: 0, description: 'Tai nghe true wireless gia tot, chong on va chat am kha.', brand: 'JBL', warranty_months: 12 },
  { name: 'Apple Watch SE 2', category: 'wearable', price: 279, stock: 55, rating: 4.5, is_featured: 0, description: 'Dong ho thong minh theo doi suc khoe va thong bao nhanh.', brand: 'Apple', warranty_months: 12 },
  { name: 'Galaxy Watch 6', category: 'wearable', price: 299, stock: 48, rating: 4.5, is_featured: 0, description: 'Dong ho Android can bang, pin tot va de dung.', brand: 'Samsung', warranty_months: 12 },
  { name: 'Xbox Wireless Controller', category: 'gaming', price: 69, stock: 120, rating: 4.5, is_featured: 0, description: 'Tay cam da nen tang, cam giac bam tot, do ben cao.', brand: 'Microsoft', warranty_months: 12 },
  { name: 'Razer BlackShark V2 X', category: 'gaming', price: 59, stock: 84, rating: 4.4, is_featured: 0, description: 'Headset gaming nhe, mic ro, am thanh dinh huong.', brand: 'Razer', warranty_months: 12 },
  { name: 'TP-Link Archer AX55', category: 'networking', price: 129, stock: 65, rating: 4.4, is_featured: 0, description: 'Router Wi-Fi 6 cho nha pho, toc do cao va on dinh.', brand: 'TP-Link', warranty_months: 24 },
  { name: 'ASUS RT-AX82U', category: 'networking', price: 189, stock: 36, rating: 4.5, is_featured: 0, description: 'Router Wi-Fi 6 cho game, do tre thap, phu song tot.', brand: 'ASUS', warranty_months: 24 },
  { name: 'Samsung T7 SSD 1TB', category: 'storage', price: 129, stock: 76, rating: 4.7, is_featured: 0, description: 'SSD di dong toc do cao, gon nhe, sao luu nhanh.', brand: 'Samsung', warranty_months: 36 },
  { name: 'WD My Passport 2TB', category: 'storage', price: 99, stock: 92, rating: 4.4, is_featured: 0, description: 'O cung di dong dung luong lon, gia hop ly.', brand: 'Western Digital', warranty_months: 24 },
  { name: 'Google Nest Cam', category: 'smart-home', price: 119, stock: 40, rating: 4.3, is_featured: 0, description: 'Camera thong minh cho gia dinh, theo doi tu xa.', brand: 'Google', warranty_months: 12 },
  { name: 'Philips Hue Starter Kit', category: 'smart-home', price: 159, stock: 33, rating: 4.5, is_featured: 0, description: 'He thong den thong minh dieu khien bang app.', brand: 'Philips', warranty_months: 12 },
  { name: 'Sony ZV-E10', category: 'camera', price: 799, stock: 22, rating: 4.6, is_featured: 0, description: 'May anh cho vlog, AF nhanh, video dep.', brand: 'Sony', warranty_months: 24 },
  { name: 'Canon EOS R50', category: 'camera', price: 899, stock: 18, rating: 4.6, is_featured: 0, description: 'May anh mirrorless de dung cho nguoi moi.', brand: 'Canon', warranty_months: 24 },
  { name: 'Anker 65W GaN Charger', category: 'accessory', price: 49, stock: 140, rating: 4.6, is_featured: 0, description: 'Sac nhanh da cong nho gon cho dien thoai va laptop.', brand: 'Anker', warranty_months: 12 },
  { name: 'Ugreen USB-C Hub 8 in 1', category: 'accessory', price: 45, stock: 128, rating: 4.3, is_featured: 0, description: 'Hub mo rong cong cho laptop van phong.', brand: 'Ugreen', warranty_months: 12 },
  { name: 'LG UltraGear 27GN800', category: 'monitor', price: 299, stock: 41, rating: 4.5, is_featured: 0, description: 'Man hinh gaming 2K 144Hz, mau sac dep.', brand: 'LG', warranty_months: 24 },
  { name: 'Dell P2723D', category: 'monitor', price: 279, stock: 37, rating: 4.4, is_featured: 0, description: 'Man hinh 27 inch 2K cho cong viec van phong.', brand: 'Dell', warranty_months: 36 },
  { name: 'Logitech MX Keys S', category: 'office', price: 119, stock: 90, rating: 4.7, is_featured: 0, description: 'Ban phim van phong cao cap, go em, da thiet bi.', brand: 'Logitech', warranty_months: 12 },
  { name: 'Logitech MX Master 3S', category: 'office', price: 109, stock: 82, rating: 4.7, is_featured: 0, description: 'Chuot nang suat cao cho designer va office.', brand: 'Logitech', warranty_months: 12 }
].concat(buildNicheSeedCatalog());

function isAdmin(req) { return String(req.headers['x-user-role'] || '').toLowerCase() === 'admin'; }
function ensureAdmin(req, res, next) { return isAdmin(req) ? next() : res.status(403).json({ message: 'Admin role required' }); }

const run = (...args) => productRepository.runRaw(...args);
const get = (...args) => productRepository.getRaw(...args);
const all = (...args) => productRepository.allRaw(...args);

async function ensureColumn() { return true; }

async function initDb() { return productRepository.initDb(); }

app.get('/health', (_, res) => res.json({ ok: true, service: 'product-service' }));
app.get('/categories', (_, res) => {
  res.json({
    tree: PRODUCT_TAXONOMY,
    flat: CATEGORIES.map((key) => ({
      key,
      label: SUBCATEGORY_INDEX.get(key)?.subLabel || key.replace('-', ' '),
      mainKey: SUBCATEGORY_INDEX.get(key)?.mainKey || 'electronics',
      mainLabel: SUBCATEGORY_INDEX.get(key)?.mainLabel || 'Electronics'
    }))
  });
});

app.get('/', productController.list);
// handled by controller
);

app.get('/featured', productController.getFeatured);

app.get('/by-ids', productController.getByIds);

app.post('/inventory/decrease', productValidators.decreaseInventory, productController.decreaseInventory);

app.get('/admin/products', ensureAdmin, productController.adminList);

app.post('/admin/products', ensureAdmin, productValidators.createProduct, productController.createProduct);

app.put('/admin/products/:id', ensureAdmin, productValidators.updateProduct, productController.updateProduct);

app.delete('/admin/products/:id', ensureAdmin, productController.deleteProduct);

app.post('/admin/products/:id/upload-image', ensureAdmin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Missing image file' });
    }

    try {
      req.publicBaseUrl = PUBLIC_BASE_URL;
      return productController.uploadProductImage(req, res);
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: 'Upload image failed', error: error.message });
    }
  });
});

app.get('/admin/reviews', ensureAdmin, productController.getAdminReviews);

app.get('/reviews/user/:uid', productController.getUserReviews);

app.get('/:id/reviews', productController.getReviewsByProduct);

app.post('/:id/reviews', productController.createReview);

app.delete('/reviews/:reviewId', ensureAdmin, productController.deleteReview);

app.get('/:id', productController.getById);

productService.initDb().then(() => {
  app.listen(port, () => {
    console.log(`Product service running on ${port}`);
  });
}).catch((error) => {
  console.error('Product service init failed', error);
  process.exit(1);
});
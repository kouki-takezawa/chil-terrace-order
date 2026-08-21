// 現在提供中のメニュー内容（店舗の紙メニュー「チルパリ 〜Terrace酒場〜 FOOD MENU」を
// そのままデータ化したもの）。prisma/seed.ts（初回デプロイ時の初期データ投入）と
// prisma/reset-menu.ts（既存メニューをこの内容に一括更新するスクリプト）の両方から
// 参照する、唯一の正（single source of truth）。メニュー内容を変更するときはここを
// 直接編集するのではなく、通常は設定＞メニュー画面から行う。ここを直接編集するのは
// 「紙メニューが刷新された」など、初期データ・一括更新の基準そのものを変えたいとき。

export interface MenuDataItem {
  name: string;
  price: number;
  description?: string;
  isRecommended?: boolean;
}

export interface MenuDataCategory {
  name: string;
  sortOrder: number;
  items: MenuDataItem[];
}

export const CURRENT_MENU: MenuDataCategory[] = [
  {
    name: "おつまみフード",
    sortOrder: 0,
    items: [
      { name: "フライドポテト", price: 500 },
      { name: "から揚げ", price: 500 },
      { name: "ポテトサラダ", price: 500 },
      { name: "イカの唐揚げ", price: 500 },
      { name: "あおりいかキムチ", price: 500 },
      { name: "たこチャンジャ", price: 500 },
      { name: "えびせん", price: 500 },
      { name: "無限レタス", price: 500 },
      { name: "チキンスティック", price: 500 },
      { name: "梅水晶", price: 500 },
      { name: "さっぱりきゅうり", price: 500, description: "味噌マヨ or 梅しそ" },
      { name: "うずらの卵", price: 500 },
      { name: "鶏なんこつ焼き", price: 500 },
      { name: "キムチ納豆", price: 500 },
      { name: "まぐろたたき", price: 500, isRecommended: true },
      { name: "アジフライ（1枚）", price: 500 },
      { name: "いいだこ唐揚げ", price: 500 },
      { name: "子持ちししゃも", price: 500 },
      { name: "ネギトロ", price: 500, isRecommended: true },
    ],
  },
  {
    name: "ご飯もの",
    sortOrder: 1,
    items: [
      { name: "ガパオライス", price: 800 },
      { name: "タコライス", price: 800 },
      { name: "牛すき焼き丼", price: 800 },
      { name: "ネギトロ丼", price: 800 },
    ],
  },
  {
    name: "鍋もの",
    sortOrder: 2,
    items: [
      { name: "鰤しゃぶセット", price: 1800, description: "1人前の価格。ご注文は2人前から" },
      { name: "明太ネギ豚しゃぶセット", price: 1800, description: "1人前の価格。ご注文は2人前から" },
      { name: "豚キムチしゃぶセット", price: 1800, description: "1人前の価格。ご注文は2人前から" },
    ],
  },
  {
    name: "数量限定メニュー",
    sortOrder: 3,
    items: [
      { name: "国産ランプステーキ", price: 2000, description: "ライスセット・数量限定", isRecommended: true },
      { name: "厳選サーロインステーキ", price: 2000, description: "ライスセット・数量限定", isRecommended: true },
    ],
  },
  {
    name: "セルフデザート",
    sortOrder: 4,
    items: [
      { name: "かき氷", price: 500, description: "イチゴ・メロン・マンゴー・抹茶からお選びください" },
      { name: "クレープ", price: 500, description: "クリーム・チョコ・バナナ・カスタード・キャラメルからお選びください" },
    ],
  },
  {
    name: "アルコール各種",
    sortOrder: 5,
    items: [
      { name: "アサヒ生ビール", price: 500 },
      { name: "焼酎（芋・麦）", price: 500 },
      { name: "カシスウーロン", price: 500 },
      { name: "ジャスミンハイ", price: 500 },
      { name: "ハイボール（角）", price: 500 },
      { name: "マリブコーク", price: 500 },
      { name: "無糖ハイ", price: 500 },
      { name: "レモンサワー", price: 500 },
      { name: "ジントニック", price: 500 },
      { name: "紅茶ハイ", price: 500 },
      { name: "ピーチウーロン", price: 500 },
      { name: "緑茶ハイ", price: 500 },
      { name: "ピーチオレンジ", price: 500 },
      { name: "ウーロンハイ", price: 500 },
      { name: "カシスオレンジ", price: 500 },
    ],
  },
  {
    name: "ソフトドリンク各種",
    sortOrder: 6,
    items: [
      { name: "緑茶", price: 350 },
      { name: "コーラ", price: 350 },
      { name: "ウーロン茶", price: 350 },
      { name: "オレンジジュース", price: 350 },
      { name: "ジャスミン茶", price: 350 },
      { name: "アップルジュース", price: 350 },
      { name: "ストレートティー", price: 350 },
      { name: "レモンティー", price: 350 },
      { name: "無糖ティー", price: 350 },
      { name: "ジンジャーエール", price: 350 },
    ],
  },
];

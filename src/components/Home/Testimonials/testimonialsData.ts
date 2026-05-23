import { Testimonial } from "@/types/testimonial";

export const getTestimonialsData = (language: "en" | "ar"): Testimonial[] => {
  const isArabic = language === "ar";
  return [
    {
      review: isArabic
        ? "فستان ابنتي من هلا دريسز كان الأجمل في حفل التخرج. القماش ناعم والخياطة دقيقة، وصلت في الوقت المحدد تماماً."
        : "My daughter's dress from Hala Dresses was the prettiest at her graduation. Soft fabric, beautiful stitching — delivered right on time.",
      authorName: isArabic ? "أم محمد" : "Um Mohammed",
      authorImg: "/images/users/user-01.jpg",
      authorRole: isArabic ? "أم من مسقط" : "Mother from Muscat",
    },
    {
      review: isArabic
        ? "تسوقت أكثر من مرة وفي كل مرة تتجاوز توقعاتي. الألوان حقيقية تماماً كما في الصور، وخدمة العملاء ممتازة."
        : "I've ordered multiple times and every time they exceed my expectations. Colors match exactly, and customer service is excellent.",
      authorName: isArabic ? "سارة الحارثي" : "Sara Al-Harthi",
      authorImg: "/images/users/user-02.jpg",
      authorRole: isArabic ? "عميلة دائمة" : "Loyal Customer",
    },
    {
      review: isArabic
        ? "اشتريت فستان مناسبة لبنتي وكان رائعاً. جودة عالية بسعر مناسب. أنصح كل أم تبحث عن أناقة حقيقية."
        : "Bought an occasion dress for my little girl and it was stunning. High quality at a fair price. I recommend it to every mother.",
      authorName: isArabic ? "منى الزدجالية" : "Mona Al-Zadjali",
      authorImg: "/images/users/user-03.jpg",
      authorRole: isArabic ? "مدوّنة موضة" : "Fashion Blogger",
    },
    {
      review: isArabic
        ? "أجمل ما في هلا دريسز أن التشكيلات تتغير دائماً وتواكب الموضة. كل زيارة أجد شيئاً جديداً يلفت انتباهي."
        : "What I love most is that the collections always stay fresh and on-trend. Every visit I discover something new that catches my eye.",
      authorName: isArabic ? "نور البوسعيدي" : "Noor Al-Busaidi",
      authorImg: "/images/users/user-01.jpg",
      authorRole: isArabic ? "مصممة أزياء" : "Fashion Designer",
    },
    {
      review: isArabic
        ? "الفستان وصل مطوياً بعناية في علبة أنيقة. كأنك تفتح هدية. هذا الاهتمام بالتفاصيل يجعلهم مختلفين."
        : "The dress arrived carefully folded in an elegant box, like unwrapping a gift. That attention to detail sets them apart.",
      authorName: isArabic ? "ريم العامري" : "Reem Al-Amri",
      authorImg: "/images/users/user-02.jpg",
      authorRole: isArabic ? "موظفة" : "Professional",
    },
    {
      review: isArabic
        ? "طلبت عبر واتساب وكانت التجربة سهلة جداً. ردوا بسرعة وأجابوا على كل أسئلتي بخصوص المقاسات والألوان."
        : "Ordered via WhatsApp and the experience was so easy. They replied quickly and answered all my size and color questions.",
      authorName: isArabic ? "هند المعمري" : "Hind Al-Maammari",
      authorImg: "/images/users/user-03.jpg",
      authorRole: isArabic ? "ربة منزل" : "Homemaker",
    },
  ];
};

const testimonialsData = getTestimonialsData("en");
export default testimonialsData;

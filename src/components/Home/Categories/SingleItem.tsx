import { StoreCategory } from "@/lib/storefront";
import Image from "next/image";
import Link from "next/link";

const SingleItem = ({ item }: { item: StoreCategory }) => {
  const href = item.slug
    ? `/shop?category=${encodeURIComponent(item.slug)}`
    : "/shop";

  return (
    <Link href={href} className="group flex flex-col items-center gap-2.5 sm:gap-3.5">
      <div className="relative w-[80px] h-[80px] xsm:w-[92px] xsm:h-[92px] sm:w-[110px] sm:h-[110px] rounded-full overflow-hidden border-[3px] sm:border-4 border-white shadow-md group-hover:shadow-lg group-hover:border-blue/30 transition-all duration-300">
        <Image
          src={item.img}
          alt={item.title}
          fill
          className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 640px) 92px, 110px"
        />
      </div>

      <h3 className="font-medium text-xs sm:text-sm text-center text-dark group-hover:text-blue transition-colors duration-200 line-clamp-1">
        {item.title}
      </h3>
    </Link>
  );
};

export default SingleItem;

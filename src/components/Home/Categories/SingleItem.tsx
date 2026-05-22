import { Category } from "@/types/category";
import Image from "next/image";
import Link from "next/link";

const SingleItem = ({ item }: { item: Category }) => {
  return (
    <Link href="/shop-with-sidebar" className="group flex flex-col items-center gap-3.5">
      <div className="relative w-[110px] h-[110px] rounded-full overflow-hidden border-4 border-white shadow-md group-hover:shadow-lg group-hover:border-blue/30 transition-all duration-300">
        <Image
          src={item.img}
          alt={item.title}
          fill
          className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
          sizes="110px"
        />
      </div>

      <h3 className="font-medium text-sm text-center text-dark group-hover:text-blue transition-colors duration-200">
        {item.title}
      </h3>
    </Link>
  );
};

export default SingleItem;

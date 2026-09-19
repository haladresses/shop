import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

type InitialState = {
  items: CartItem[];
};

// One cart line per product+variant combination. `id` is the unique line key
// (the product id alone, or `${productId}::${variantId}` when a variant is
// picked) so two colors/sizes of the same product get separate lines instead
// of merging into one. `productId` is always the real product id, used when
// submitting the order.
type CartColorPart = { part: string; color: string; colorHex?: string | null };

type CartItem = {
  id: string;
  productId: string;
  slug?: string;
  variantId?: string;
  color?: string;
  colorHex?: string;
  // Per-region breakdown when this option is itself multi-color (e.g. yellow
  // sleeves + blue body), so the cart/checkout/order can show it.
  colorParts?: CartColorPart[];
  size?: string;
  title: string;
  price: number;
  discountedPrice: number;
  quantity: number;
  imgs?: {
    thumbnails: string[];
    previews: string[];
  };
};

type AddItemToCartPayload = Omit<CartItem, "id" | "productId"> & { id: string };

const initialState: InitialState = {
  items: [],
};

export const cart = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItemToCart: (state, action: PayloadAction<AddItemToCartPayload>) => {
      const { id, variantId, quantity, ...rest } = action.payload;
      const productId = id;
      const lineId = variantId ? `${productId}::${variantId}` : productId;
      const existingItem = state.items.find((item) => item.id === lineId);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        state.items.push({
          ...rest,
          id: lineId,
          productId,
          variantId,
          quantity,
        });
      }
    },
    removeItemFromCart: (state, action: PayloadAction<string>) => {
      const itemId = action.payload;
      state.items = state.items.filter((item) => item.id !== itemId);
    },
    updateCartItemQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const { id, quantity } = action.payload;
      const existingItem = state.items.find((item) => item.id === id);

      if (existingItem) {
        existingItem.quantity = quantity;
      }
    },

    removeAllItemsFromCart: (state) => {
      state.items = [];
    },
  },
});

export const selectCartItems = (state: RootState) => state.cartReducer.items;

export const selectTotalPrice = createSelector([selectCartItems], (items) => {
  return items.reduce((total, item) => {
    return total + item.discountedPrice * item.quantity;
  }, 0);
});

export const {
  addItemToCart,
  removeItemFromCart,
  updateCartItemQuantity,
  removeAllItemsFromCart,
} = cart.actions;
export default cart.reducer;

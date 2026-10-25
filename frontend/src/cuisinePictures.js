import fastFoodImage from "./Image/cuisine-fastfood.png";
import pizzaImage from "./Image/cuisine-pizza.png";
import cafeImage from "./Image/cuisine-coffee.png";
import biryaniImage from "./Image/cuisine-biryani.png";
import dessertImage from "./Image/cuisine-cake.png";
import bangladeshiImage from "./Image/cuisine-fish.png";
import chineseImage from "./Image/chinese.png";
import koreanImage from "./Image/korean.png";
import indianImage from "./Image/indian.png";
import drinkImage from "./Image/drink.png";

/* ================= CUISINE PICTURES ================= */

// The pictures we have, found by a word in the cuisine's name ("Fast Food", "Desert" ...).
// A cuisine with no picture gets null: the pages show a tile with its first letter instead.
const pictures = [
  ["fast", fastFoodImage],
  ["pizza", pizzaImage],
  ["cafe", cafeImage],
  ["coffee", cafeImage],
  ["biryani", biryaniImage],
  ["dess", dessertImage],
  ["desert", dessertImage],
  ["cake", dessertImage],
  ["bangla", bangladeshiImage],
  ["bengali", bangladeshiImage],
  ["chinese", chineseImage],
  ["korean", koreanImage],
  ["indian", indianImage],
  ["drink", drinkImage],
  ["beverage", drinkImage],
  ["juice", drinkImage],
];

export function pictureFor(name) {
  const text = String(name).toLowerCase();

  return pictures.find(([word]) => text.includes(word))?.[1] ?? null;
}

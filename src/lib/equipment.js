
// Which equipment items belong on a given semester's budget page: anything
// still on the wishlist (shows on every semester until bought), plus
// whatever was actually purchased during this specific semester.
export function equipmentItemsForSemester(
  items,
  semesterId,
) {
  return items.filter(
    (item) => item.purchasedSemesterId === null || item.purchasedSemesterId === semesterId,
  );
}

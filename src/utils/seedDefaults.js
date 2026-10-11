import Category from '../models/Category.js'

export const DEFAULT_USER_CATEGORIES = [
  // Incomes (Common Mexican personal finance profile)
  { name: 'Salary', type: 'income', icon: 'BanknotesIcon', color: '#10b981', order: 0, plannedAmount: 0 },
  { name: 'Food Vouchers', type: 'income', icon: 'CreditCardIcon', color: '#0ea5e9', order: 1, plannedAmount: 0 },
  { name: 'Investments & Returns', type: 'income', icon: 'ChartBarIcon', color: '#8b5cf6', order: 2, plannedAmount: 0 },
  
  // Expenses
  { name: 'Housing & Rent', type: 'expense', icon: 'HomeModernIcon', color: '#f43f5e', order: 0, plannedAmount: 0 },
  { name: 'Food & Groceries', type: 'expense', icon: 'CakeIcon', color: '#f59e0b', order: 1, plannedAmount: 0 },
  { name: 'Transportation', type: 'expense', icon: 'TruckIcon', color: '#6366f1', order: 2, plannedAmount: 0 },
  { name: 'Utilities & Services', type: 'expense', icon: 'BoltIcon', color: '#ec4899', order: 3, plannedAmount: 0 },
  { name: 'Entertainment', type: 'expense', icon: 'FilmIcon', color: '#06b6d4', order: 4, plannedAmount: 0 },
]

/**
 * Ensures that the user has at least the default categories configured.
 * Safely provisions them if the user's category list is completely empty.
 */
export async function seedDefaultCategoriesForUser(userId) {
  const existingCount = await Category.countDocuments({ userId })
  if (existingCount > 0) {
    return []
  }

  const categoriesToInsert = DEFAULT_USER_CATEGORIES.map((cat) => ({
    ...cat,
    userId,
  }))

  return Category.insertMany(categoriesToInsert)
}

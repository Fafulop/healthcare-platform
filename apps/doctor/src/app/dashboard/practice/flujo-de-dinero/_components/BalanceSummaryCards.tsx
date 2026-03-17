'use client';

import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { Balance } from './ledger-types';
import { formatCurrency } from './ledger-utils';

interface Props {
  balance: Balance;
}

export function BalanceSummaryCards({ balance }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-t-4 border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Balance Actual</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(balance.balance)}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-t-4 border-teal-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Total Ingresos</p>
            <p className="text-lg sm:text-2xl font-bold text-teal-700 truncate">{formatCurrency(balance.totalIngresos)}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-t-4 border-rose-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-gray-600">Total Egresos</p>
            <p className="text-lg sm:text-2xl font-bold text-rose-600 truncate">{formatCurrency(balance.totalEgresos)}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-50 rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

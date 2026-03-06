'use client';

import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { Balance } from './ledger-types';
import { formatCurrency } from './ledger-utils';

interface Props {
  balance: Balance;
}

export function BalanceSummaryCards({ balance }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-6 border-t-4 border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Balance Actual</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance.balance)}</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border-t-4 border-teal-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Ingresos</p>
            <p className="text-2xl font-bold text-teal-700">{formatCurrency(balance.totalIngresos)}</p>
          </div>
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-teal-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border-t-4 border-rose-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Egresos</p>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(balance.totalEgresos)}</p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

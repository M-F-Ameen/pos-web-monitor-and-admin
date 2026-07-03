import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Chart Container Component
 * Wrapper for charts with loading and error states
 */
export function ChartContainer({
  title,
  subtitle,
  isLoading,
  className,
  children,
}: ChartContainerProps) {
  return (
    <div className={cn('kpi-card', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="h-64 w-full">{children}</div>
      )}
    </div>
  );
}

// Colors for charts matching Tager theme
const COLORS = ['#001F5C', '#2AB92A', '#00C853', '#E74C3C', '#FFA500'];
const GRID_STROKE = '#d7dee8';
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(255,255,255,0.78)',
  borderRadius: '18px',
  boxShadow: '0 18px 36px rgba(148, 163, 184, 0.18)',
  backdropFilter: 'blur(14px)',
};

interface DataPoint {
  name: string;
  value?: number;
  [key: string]: any;
}

interface SalesChartProps {
  data: DataPoint[];
  isLoading?: boolean;
  title?: string;
  type?: 'line' | 'bar';
}

/**
 * Sales Chart Component
 * Line or bar chart for displaying sales trends
 */
export function SalesChart({
  data,
  isLoading,
  title = 'اتجاه المبيعات',
  type = 'line',
}: SalesChartProps) {
  return (
    <ChartContainer title={title} isLoading={isLoading}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis
              dataKey="name"
              stroke="#666"
              style={{ fontSize: '12px' }}
              tick={{ textAnchor: 'end', height: 80 }}
            />
            <YAxis stroke="#666" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => `${value.toLocaleString('ar-SA')}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2AB92A"
              strokeWidth={3}
              dot={{ fill: '#2AB92A', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis
              dataKey="name"
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#666" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => `${value.toLocaleString('ar-SA')}`}
            />
            <Bar dataKey="value" fill="#2AB92A" radius={[10, 10, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface CashMovementChartProps {
  data: DataPoint[];
  isLoading?: boolean;
  title?: string;
}

/**
 * Cash Movement Chart Component
 * Line chart for displaying cash flow
 */
export function CashMovementChart({
  data,
  isLoading,
  title = 'حركة الأموال',
}: CashMovementChartProps) {
  return (
    <ChartContainer title={title} isLoading={isLoading}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="name"
            stroke="#666"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#666" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: any) => `${value.toLocaleString('ar-SA')}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#2AB92A"
            strokeWidth={3}
            dot={{ fill: '#2AB92A', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
            name="الإيرادات"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#E74C3C"
            strokeWidth={3}
            dot={{ fill: '#E74C3C', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
            name="المصروفات"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface TopProductsChartProps {
  data: Array<{ name: string; value: number }>;
  isLoading?: boolean;
  title?: string;
  type?: 'pie' | 'bar';
}

/**
 * Top Products Chart Component
 * Pie or bar chart for top products
 */
export function TopProductsChart({
  data,
  isLoading,
  title = 'أفضل المنتجات',
  type = 'pie',
}: TopProductsChartProps) {
  return (
    <ChartContainer title={title} isLoading={isLoading}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) =>
                `${name}: ${value.toLocaleString('ar-SA')}`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => `${value.toLocaleString('ar-SA')}`}
            />
          </PieChart>
        ) : (
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis type="number" stroke="#666" style={{ fontSize: '12px' }} />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#666"
              style={{ fontSize: '12px' }}
              width={100}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any) => `${value.toLocaleString('ar-SA')}`}
            />
            <Bar dataKey="value" fill="#2AB92A" radius={[0, 10, 10, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  );
}

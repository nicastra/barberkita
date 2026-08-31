import { useState, type FormEvent } from 'react';

import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type Customer,
  type CustomerInput,
} from '@/api/customers';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const fieldClass =
  'border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm';
const emptyCustomer: CustomerInput = {
  name: '',
  phone: '',
  email: null,
  notes: '',
};

interface CustomerPanelProps {
  customers: Customer[];
  selectedId: string | null;
  onCustomersChange: (customers: Customer[]) => void;
  onSelect: (id: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function CustomerPanel({
  customers,
  selectedId,
  onCustomersChange,
  onSelect,
  onError,
  onNotice,
}: CustomerPanelProps) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<CustomerInput>(emptyCustomer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  function reset() {
    setDraft(emptyCustomer);
    setEditingId(null);
  }

  function edit(customer: Customer) {
    setEditingId(customer.id);
    setDraft({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
    });
    onSelect(customer.id);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await updateCustomer(editingId, draft)
        : await createCustomer(draft);
      const exists = customers.some(
        (customer) => customer.id === response.customer.id,
      );
      onCustomersChange(
        exists
          ? customers.map((customer) =>
              customer.id === response.customer.id
                ? response.customer
                : customer,
            )
          : [...customers, response.customer],
      );
      onSelect(response.customer.id);
      onNotice(
        response.duplicate
          ? 'An existing customer with that phone number was selected.'
          : editingId
            ? 'Customer updated.'
            : 'Customer created.',
      );
      reset();
    } catch {
      onError('The customer record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    try {
      const response = await listCustomers(search);
      onCustomersChange(response.customers);
      if (
        selectedId &&
        !response.customers.some((customer) => customer.id === selectedId)
      )
        onSelect(response.customers[0]?.id ?? '');
    } catch {
      onError('Customer search failed.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>
          Search normalized contact details or maintain a customer record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="flex gap-2"
          onSubmit={(event) => void runSearch(event)}
        >
          <label className="sr-only" htmlFor="customer-search">
            Search customers
          </label>
          <input
            id="customer-search"
            className="border-input bg-background min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            placeholder="Search name, phone, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </form>
        <form
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(event) => void save(event)}
        >
          <h3 className="font-medium sm:col-span-2">
            {editingId ? 'Edit customer' : 'Add customer'}
          </h3>
          <label className="text-sm font-medium">
            Name
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              required
            />
          </label>
          <label className="text-sm font-medium">
            Phone
            <input
              className={fieldClass}
              type="tel"
              value={draft.phone}
              onChange={(event) =>
                setDraft({ ...draft, phone: event.target.value })
              }
              required
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Email
            <input
              className={fieldClass}
              type="email"
              value={draft.email ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, email: event.target.value || null })
              }
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Operational notes
            <textarea
              className={fieldClass}
              rows={2}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Saving…'
                : editingId
                  ? 'Save customer'
                  : 'Add customer'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        {customers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No customers match this search.
          </p>
        ) : (
          <div className="divide-border divide-y">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <button
                  type="button"
                  className={`text-left ${selectedId === customer.id ? 'text-primary' : ''}`}
                  onClick={() => onSelect(customer.id)}
                >
                  <span className="block text-sm font-medium">
                    {customer.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {customer.phone}
                    {customer.email ? ` · ${customer.email}` : ''}
                  </span>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => edit(customer)}
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

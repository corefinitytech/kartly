"use client";

import { useActionState, useState } from "react";
import { MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorSummary, NoticeBanner, SubmitButton } from "@/components/auth/form-kit";
import { Input } from "@/components/ui/input";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAction,
  updateAddressAction,
} from "@/modules/addresses/actions";
import type { AddressView } from "@/modules/addresses/service";
import { COUNTRY_CODES, MAX_ADDRESSES } from "@/modules/addresses/schemas";
import { countryName } from "@/modules/addresses/schemas";

function AddressFields({ address }: { address?: AddressView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="fullName" className="block text-sm text-inkSoft">Full name</label>
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={address?.fullName} required className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="line1" className="block text-sm text-inkSoft">Address line 1</label>
        <Input id="line1" name="line1" autoComplete="address-line1" defaultValue={address?.line1} required className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="line2" className="block text-sm text-inkSoft">Address line 2 (optional)</label>
        <Input id="line2" name="line2" autoComplete="address-line2" defaultValue={address?.line2 ?? ""} className="mt-1" />
      </div>
      <div>
        <label htmlFor="city" className="block text-sm text-inkSoft">City</label>
        <Input id="city" name="city" autoComplete="address-level2" defaultValue={address?.city} required className="mt-1" />
      </div>
      <div>
        <label htmlFor="region" className="block text-sm text-inkSoft">Region or state</label>
        <Input id="region" name="region" autoComplete="address-level1" defaultValue={address?.region ?? ""} className="mt-1" />
      </div>
      <div>
        <label htmlFor="postalCode" className="block text-sm text-inkSoft">Postal code</label>
        <Input id="postalCode" name="postalCode" autoComplete="postal-code" defaultValue={address?.postalCode} required className="mt-1" />
      </div>
      <div>
        <label htmlFor="country" className="block text-sm text-inkSoft">Country</label>
        <select
          id="country"
          name="country"
          autoComplete="country"
          defaultValue={address?.country ?? "US"}
          className="mt-1 h-11 w-full rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink"
        >
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>{countryName(code)}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="phone" className="block text-sm text-inkSoft">Phone (optional)</label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={address?.phone ?? ""} className="mt-1" />
      </div>
    </div>
  );
}

function AddressForm({
  address,
  onDone,
}: {
  address?: AddressView;
  onDone: () => void;
}) {
  const action = address ? updateAddressAction : createAddressAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}
      <ErrorSummary state={state} />
      <NoticeBanner state={state} />
      <AddressFields address={address} />
      <div className="flex gap-2">
        <SubmitButton pending={pending}>{address ? "Save address" : "Add address"}</SubmitButton>
        <Button type="button" variant="tertiary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function AddressesView({ addresses }: { addresses: AddressView[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Addresses</h1>
      <ul className="mt-4 space-y-4">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-card border border-line bg-surface p-4">
            {editingId === address.id ? (
              <AddressForm address={address} onDone={() => setEditingId(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{address.fullName}</p>
                    <p className="text-sm text-inkSoft">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city}
                      {address.region ? `, ${address.region}` : ""} {address.postalCode},{" "}
                      {countryName(address.country)}
                    </p>
                    {address.phone ? <p className="text-sm text-inkSoft">{address.phone}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    {address.isDefaultShipping ? <Badge variant="success">Default shipping</Badge> : null}
                    {address.isDefaultBilling ? <Badge variant="success">Default billing</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Button variant="tertiary" size="sm" onClick={() => setEditingId(address.id)}>
                    <Pencil strokeWidth={1.75} className="h-4 w-4" /> Edit
                  </Button>
                  {!address.isDefaultShipping ? (
                    <form action={setDefaultAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <input type="hidden" name="role" value="shipping" />
                      <Button variant="tertiary" size="sm" type="submit">
                        <Star strokeWidth={1.75} className="h-4 w-4" /> Default shipping
                      </Button>
                    </form>
                  ) : null}
                  {!address.isDefaultBilling ? (
                    <form action={setDefaultAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <input type="hidden" name="role" value="billing" />
                      <Button variant="tertiary" size="sm" type="submit">
                        <Star strokeWidth={1.75} className="h-4 w-4" /> Default billing
                      </Button>
                    </form>
                  ) : null}
                  {confirmDeleteId === address.id ? (
                    <form action={deleteAddressAction} className="flex items-center gap-2">
                      <input type="hidden" name="addressId" value={address.id} />
                      <Button variant="tertiary" size="sm" type="submit" className="text-danger">
                        <Trash2 strokeWidth={1.75} className="h-4 w-4" /> Confirm delete
                      </Button>
                      <Button variant="text" size="sm" type="button" onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </Button>
                    </form>
                  ) : (
                    <Button variant="text" size="sm" onClick={() => setConfirmDeleteId(address.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
        {addresses.length === 0 && !adding ? (
          <li className="flex flex-col items-start gap-2 rounded-card border border-line bg-surface px-6 py-10">
            <MapPin strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
            <p className="text-lg font-semibold">No addresses yet</p>
            <p className="text-sm text-inkSoft">Add an address to speed up checkout.</p>
          </li>
        ) : null}
      </ul>

      {adding ? (
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <AddressForm onDone={() => setAdding(false)} />
        </div>
      ) : addresses.length < MAX_ADDRESSES ? (
        <Button variant="secondary" className="mt-4" onClick={() => setAdding(true)}>
          Add an address
        </Button>
      ) : (
        <p className="mt-4 text-sm text-inkMuted">You have reached the maximum of {MAX_ADDRESSES} addresses.</p>
      )}
    </div>
  );
}

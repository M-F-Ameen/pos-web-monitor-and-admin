import { useState, useMemo } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  IconUser,
  IconPhone,
  IconPlus,
  IconSearch,
  IconCheckCircle,
} from "../../ui/Icons";
import type { Customer } from "../../../app/pos/types";
import "./CustomerModal.css";

export interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  isLoading?: boolean;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onAddCustomer?: (customer: Omit<Customer, "id">) => void;
}

/**
 * Customer selection/search modal.
 * Allows selecting existing customers or adding new ones.
 */
export function CustomerModal({
  isOpen,
  onClose,
  customers,
  isLoading = false,
  selectedCustomer,
  onSelectCustomer,
  onAddCustomer,
}: CustomerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone?.includes(query) ||
        customer.email?.toLowerCase().includes(query),
    );
  }, [customers, searchQuery]);

  function handleSelect(customer: Customer) {
    onSelectCustomer(customer);
    onClose();
    resetForm();
  }

  function handleRemoveSelection() {
    onSelectCustomer(null);
  }

  function handleAddNew() {
    if (!newCustomer.name.trim()) return;

    onAddCustomer?.({
      name: newCustomer.name.trim(),
      phone: newCustomer.phone.trim() || undefined,
      email: newCustomer.email.trim() || undefined,
      address: newCustomer.address.trim() || undefined,
    });

    setIsAddingNew(false);
    setNewCustomer({ name: "", phone: "", email: "", address: "" });
  }

  function resetForm() {
    setSearchQuery("");
    setIsAddingNew(false);
    setNewCustomer({ name: "", phone: "", email: "", address: "" });
  }

  function handleClose() {
    onClose();
    resetForm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="اختيار العميل"
      size="md"
    >
      <div className="customer-modal">
        {/* Current Selection */}
        {selectedCustomer && (
          <div className="customer-modal__current">
            <div className="customer-modal__current-info">
              <IconUser />
              <div>
                <span className="customer-modal__current-name">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.phone && (
                  <span className="customer-modal__current-phone">
                    {selectedCustomer.phone}
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemoveSelection}>
              إزالة
            </Button>
          </div>
        )}

        {!isAddingNew ? (
          <>
            {/* Search */}
            <div className="customer-modal__search">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو رقم الهاتف..."
                fullWidth
                icon={<IconSearch />}
              />
            </div>

            {/* Customer List */}
            <div className="customer-modal__list">
              {isLoading ? (
                <div className="customer-modal__empty">
                  <p>جار تحميل العملاء...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="customer-modal__empty">
                  <p>لا يوجد عملاء مطابقين</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`customer-modal__item ${
                      selectedCustomer?.id === customer.id
                        ? "customer-modal__item--selected"
                        : ""
                    }`}
                    onClick={() => handleSelect(customer)}
                  >
                    <div className="customer-modal__item-icon">
                      <IconUser />
                    </div>
                    <div className="customer-modal__item-info">
                      <span className="customer-modal__item-name">
                        {customer.name}
                      </span>
                      {customer.phone && (
                        <span className="customer-modal__item-phone">
                          <IconPhone /> {customer.phone}
                        </span>
                      )}
                    </div>
                    {selectedCustomer?.id === customer.id && (
                      <span className="customer-modal__item-check">
                        <IconCheckCircle />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Add New Button */}
            <Button
              variant="secondary"
              fullWidth
              icon={<IconPlus />}
              onClick={() => setIsAddingNew(true)}
            >
              إضافة عميل جديد
            </Button>
          </>
        ) : (
          <>
            {/* Add New Customer Form */}
            <div className="customer-modal__form">
              <Input
                type="text"
                value={newCustomer.name}
                onChange={(e) =>
                  setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="اسم العميل *"
                fullWidth
                icon={<IconUser />}
              />
              <Input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="رقم الهاتف"
                fullWidth
                icon={<IconPhone />}
              />
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) =>
                  setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="البريد الإلكتروني"
                fullWidth
              />
              <Input
                type="text"
                value={newCustomer.address}
                onChange={(e) =>
                  setNewCustomer((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                placeholder="العنوان"
                fullWidth
              />
            </div>

            <div className="customer-modal__form-actions">
              <Button variant="ghost" onClick={() => setIsAddingNew(false)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleAddNew}
                disabled={!newCustomer.name.trim()}
              >
                إضافة العميل
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

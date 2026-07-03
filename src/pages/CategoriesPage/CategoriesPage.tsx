import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { TablePagination } from "../../components/ui/TablePagination";
import {
  IconGrid,
  IconSearch,
  IconPlus,
} from "../../components/ui/Icons";
import { isAppPage } from "../../app/access";
import { buildSidebarNavItems } from "../../app/appSidebarNav";
import { useAuth } from "../../app/AuthContext";
import {
  categories as categoriesService,
  products as productsService,
} from "../../services/db";
import type { Category, ProductLite } from "../../services/db";
import { useDefaultImage } from "../../app/DefaultImageContext";
import "../InventoryPage/InventoryPage.css";

const ITEMS_PER_PAGE = 13;

export function CategoriesPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const defaultImage = useDefaultImage();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsList, setProductsList] = useState<ProductLite[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImage, setCategoryImage] = useState("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageMessage, setPageMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!pageMessage) return;
    const timeoutId = window.setTimeout(() => setPageMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [pageMessage]);

  const loadData = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        categoriesService.list(),
        productsService.listLite(),
      ]);
      setCategories(cats);
      setProductsList(prods);
    } catch (err) {
      console.error("Failed to load categories:", err);
      setPageMessage({ type: "error", text: "فشل في تحميل التصنيفات." });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const quantityByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of productsList) {
      if (!item.categoryId) continue;
      map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + item.stock);
    }
    return map;
  }, [productsList]);

  const totalPriceByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of productsList) {
      if (!item.categoryId) continue;
      map.set(
        item.categoryId,
        (map.get(item.categoryId) ?? 0) + item.price * item.stock,
      );
    }
    return map;
  }, [productsList]);

  const filteredCategories = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return categories;
    }

    return categories.filter((category) =>
      [category.name, `${quantityByCategoryId.get(category.id) ?? 0}`]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [categories, quantityByCategoryId, searchValue]);

  const totalQuantity = useMemo(
    () => productsList.reduce((sum, item) => sum + item.stock, 0),
    [productsList],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCategories.length / ITEMS_PER_PAGE)),
    [filteredCategories.length],
  );

  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCategories.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCategories, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  function resetForm() {
    setEditingId(null);
    setCategoryName("");
    setCategoryImage("");
    setImagePreview("");
    setError("");
  }

  function openAddModal() {
    if (!canManage) return;
    resetForm();
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function openEditModal(category: Category) {
    if (!canManage) return;
    setEditingId(category.id);
    setCategoryName(category.name);
    const existingImage = category.image || "";
    setCategoryImage(existingImage);
    setImagePreview(existingImage || defaultImage);
    setError("");
    setIsModalOpen(true);
  }

  async function handleDeleteCategory(id: string) {
    if (!canManage) return;
    try {
      await categoriesService.delete(id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete category:", err);
      setPageMessage({ type: "error", text: "فشل في حذف التصنيف." });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const trimmedName = categoryName.trim();

    if (!trimmedName) {
      setError("يرجى إدخال اسم التصنيف.");
      return;
    }

    const isDuplicate = categories.some(
      (category) =>
        category.id !== editingId &&
        category.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      setError("اسم التصنيف موجود بالفعل.");
      return;
    }

    const imageToSave = categoryImage || defaultImage;

    try {
      if (editingId) {
        await categoriesService.update(editingId, {
          name: trimmedName,
          image: imageToSave,
        });
      } else {
        await categoriesService.create({
          name: trimmedName,
          image: imageToSave,
        });
      }

      closeModal();
      await loadData();
    } catch (err) {
      console.error("Failed to save category:", err);
      setError("فشل في حفظ التصنيف.");
    }
  }

  return (
    <div className="inventory-page">
      <NavSidebar
        items={buildSidebarNavItems("categories", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
            return;
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="inventory-page__main">
        <section className="inventory-page__content">
          <header className="inventory-toolbar">
            <div className="inventory-toolbar__brand">
              <div>
                <h1 className="inventory-toolbar__title">التصنيفات</h1>
              </div>
            </div>
            <div className="inventory-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث باسم التصنيف"
                className="inventory-toolbar__search"
                fullWidth
              />
              <div className="inventory-toolbar__chips">
                <span className="inventory-chip">
                  التصنيفات: {categories.length}
                </span>
                <span className="inventory-chip">
                  إجمالي الكمية: {totalQuantity}
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={!canManage}
              >
                إضافة تصنيف
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`inventory-page__message inventory-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="inventory-table-card" aria-label="جدول التصنيفات">
            <div className="inventory-table-card__header">
              <h2>قائمة التصنيفات</h2>
            </div>

            {filteredCategories.length === 0 ? (
              <p className="inventory-table-card__empty">
                لا توجد تصنيفات مطابقة. اضغط "إضافة تصنيف" لإدخال تصنيف جديد.
              </p>
            ) : (
              <div className="inventory-table-card__scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصورة</th>
                      <th>اسم التصنيف</th>
                      <th>إجمالي الكمية</th>
                      <th>إجمالي السعر</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCategories.map((category, index) => (
                      <tr key={category.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>
                          <img
                            src={
                              category.image && category.image !== ""
                                ? category.image
                                : defaultImage
                            }
                            alt={category.name}
                            className="inventory-table__product-image"
                            onError={(e) => {
                              e.currentTarget.src = defaultImage;
                            }}
                          />
                        </td>
                        <td>{category.name}</td>
                        <td>{quantityByCategoryId.get(category.id) ?? 0}</td>
                        <td>
                          {(
                            totalPriceByCategoryId.get(category.id) ?? 0
                          ).toFixed(2)}{" "}
                          LE
                        </td>
                        <td>
                          <div className="inventory-table__actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(category)}
                              disabled={!canManage}
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                              disabled={!canManage}
                            >
                              حذف
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredCategories.length > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </section>
        </section>
      </main>

      {isModalOpen && (
        <div
          className="inventory-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل تصنيف" : "إضافة تصنيف جديد"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="inventory-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="inventory-modal__header">
              <h3>{editingId ? "تعديل تصنيف" : "إضافة تصنيف جديد"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="inventory-modal__error">{error}</p>}

            <div className="inventory-modal__fields">
              <label className="inventory-modal__field">
                <span>اسم التصنيف *</span>
                <Input
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value);
                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="مثال: سجاير"
                  fullWidth
                />
              </label>
              <label className="inventory-modal__field">
                <span>صورة التصنيف (اختياري)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = reader.result as string;
                        setCategoryImage(base64String);
                        setImagePreview(base64String);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="inventory-modal__file-input"
                />
                {imagePreview && (
                  <div className="inventory-modal__image-preview">
                    <img src={imagePreview} alt="معاينة الصورة" />
                  </div>
                )}
              </label>{" "}
            </div>

            <div className="inventory-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                {editingId ? "حفظ التعديلات" : "إضافة التصنيف"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

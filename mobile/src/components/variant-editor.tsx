import {
  listCompanies,
  listWarehouses,
  type StockLocation,
  type VariantInput,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { dict } from "../i18n";
import { useTheme } from "../theme-context";
import { ChoiceRow, Field } from "./form";
import { Card, Row, Txt, VStack } from "./ui";

/**
 * Selling one product in several forms — sizes, colours, or both.
 *
 * The base price becomes the cheapest variant server-side, so a card can
 * honestly say "from 250". That is why a row's price is optional: left blank it
 * inherits the product's, which is what a seller means when every size costs
 * the same.
 */
export function VariantEditor({
  enabled,
  onToggle,
  optionName,
  onOptionName,
  optionName2,
  onOptionName2,
  rows,
  onRows,
}: {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  optionName: string;
  onOptionName: (value: string) => void;
  optionName2: string;
  onOptionName2: (value: string) => void;
  rows: VariantInput[];
  onRows: (rows: VariantInput[]) => void;
}) {
  const t = dict();
  const { c, space } = useTheme();

  const update = (index: number, patch: Partial<VariantInput>) =>
    onRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Card>
      <VStack gap="md">
        <Pressable onPress={() => onToggle(!enabled)}>
          <Row gap="sm">
            <Ionicons
              name={enabled ? "checkbox" : "square-outline"}
              size={20}
              color={enabled ? c.blue : c.ink400}
            />
            <Txt variant="label" style={{ flex: 1 }}>
              {t.vvTitle}
            </Txt>
          </Row>
        </Pressable>

        <Txt variant="caption" tone="faint">
          {t.vvHint}
        </Txt>

        {enabled && (
          <>
            <Row gap="md">
              <View style={{ flex: 1 }}>
                <Field
                  label={t.vvOptionName}
                  value={optionName}
                  onChange={onOptionName}
                  placeholder={t.vvOptionHint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t.vvOptionName2}
                  value={optionName2}
                  onChange={onOptionName2}
                  placeholder={t.vpOptional}
                />
              </View>
            </Row>

            {rows.map((row, index) => (
              <VStack key={index} gap="sm">
                <Row gap="sm">
                  <View style={{ flex: 1 }}>
                    <Field
                      label={optionName.trim() || t.vvValue}
                      value={row.option_value}
                      onChange={(value) => update(index, { option_value: value })}
                      placeholder={t.vvValueHint}
                    />
                  </View>
                  {/* The second axis only exists once it has been named. */}
                  {!!optionName2.trim() && (
                    <View style={{ flex: 1 }}>
                      <Field
                        label={optionName2.trim()}
                        value={row.option_value2 ?? ""}
                        onChange={(value) => update(index, { option_value2: value })}
                        placeholder={t.vvValueHint}
                      />
                    </View>
                  )}
                </Row>
                <Row gap="sm" align="flex-end">
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.vpPrice}
                      value={row.price ? String(row.price) : ""}
                      onChange={(value) => update(index, { price: Number(value) || 0 })}
                      keyboardType="numeric"
                      placeholder={t.vvSamePrice}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t.vpStock}
                      value={row.stock_qty != null ? String(row.stock_qty) : ""}
                      onChange={(value) => update(index, { stock_qty: Number(value) || 0 })}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  <Pressable
                    onPress={() => onRows(rows.filter((_, i) => i !== index))}
                    hitSlop={8}
                    style={{ paddingBottom: space.md }}
                  >
                    <Ionicons name="close-circle" size={20} color={c.ink400} />
                  </Pressable>
                </Row>
              </VStack>
            ))}

            <Pressable
              onPress={() => onRows([...rows, { option_value: "", stock_qty: 0 }])}
              style={{ alignSelf: "flex-start" }}
            >
              <Row gap="xs">
                <Ionicons name="add-circle-outline" size={16} color={c.blue} />
                <Txt variant="caption" tone="blue">
                  {t.vvAdd}
                </Txt>
              </Row>
            </Pressable>
          </>
        )}
      </VStack>
    </Card>
  );
}

/**
 * Stock held at more than one branch.
 *
 * Hidden entirely when the store has no warehouses to choose from, which is
 * most of them — an empty picker is a question a seller cannot answer.
 * `governorate` is what lets the order router prefer the branch nearest the
 * buyer, so it is offered plainly rather than buried as an advanced field.
 */
export function StockLocationEditor({
  rows,
  onRows,
}: {
  rows: StockLocation[];
  onRows: (rows: StockLocation[]) => void;
}) {
  const t = dict();
  const { c, space } = useTheme();
  const [companies, setCompanies] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ name: string; company: string }>>([]);

  useEffect(() => {
    void listCompanies().then((found) => setCompanies(found.map((r) => r.name)));
    void listWarehouses().then(setWarehouses);
  }, []);

  if (!warehouses.length) return null;

  const update = (index: number, patch: Partial<StockLocation>) =>
    onRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Card>
      <VStack gap="md">
        <Txt variant="label">{t.vlocTitle}</Txt>
        <Txt variant="caption" tone="faint">
          {t.vlocHint}
        </Txt>

        {rows.map((row, index) => {
          const options = warehouses.filter((w) => !row.company || w.company === row.company);
          return (
            <VStack key={index} gap="sm">
              <ChoiceRow
                options={companies.map((name) => ({ value: name, label: name }))}
                value={row.company || null}
                // Changing the company clears the warehouse. A warehouse from
                // the previous company is dropped server-side, and a row that
                // looks saved but is not is worse than one that looks unfinished.
                onChange={(value) => update(index, { company: value, warehouse: "" })}
              />
              <ChoiceRow
                options={options.map((w) => ({ value: w.name, label: w.name }))}
                value={row.warehouse || null}
                onChange={(value) => update(index, { warehouse: value })}
              />
              <Row gap="sm" align="flex-end">
                <View style={{ flex: 1 }}>
                  <Field
                    label={t.governorate}
                    value={row.governorate ?? ""}
                    onChange={(value) => update(index, { governorate: value })}
                    placeholder={t.vpOptional}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t.vpStock}
                    value={row.stock_qty != null ? String(row.stock_qty) : ""}
                    onChange={(value) => update(index, { stock_qty: Number(value) || 0 })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <Pressable
                  onPress={() => onRows(rows.filter((_, i) => i !== index))}
                  hitSlop={8}
                  style={{ paddingBottom: space.md }}
                >
                  <Ionicons name="close-circle" size={20} color={c.ink400} />
                </Pressable>
              </Row>
            </VStack>
          );
        })}

        <Pressable
          onPress={() => onRows([...rows, { company: "", warehouse: "", stock_qty: 0 }])}
          style={{ alignSelf: "flex-start" }}
        >
          <Row gap="xs">
            <Ionicons name="add-circle-outline" size={16} color={c.blue} />
            <Txt variant="caption" tone="blue">
              {t.vlocAdd}
            </Txt>
          </Row>
        </Pressable>
      </VStack>
    </Card>
  );
}

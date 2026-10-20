// Дата останньої перевірки статті на відповідність джерелам (reviewed: РРРР-ММ-ДД)
// потрапляє в розмітку MedicalWebPage як lastReviewed. Перевіряти статті — щонайменше раз на 12 місяців.
module.exports = {
  eleventyComputed: {
    schema: (data) => {
      if (!data.schema || !data.reviewed) return data.schema;
      const d = data.reviewed instanceof Date ? data.reviewed.toISOString().slice(0, 10) : String(data.reviewed);
      return { ...data.schema, lastReviewed: d };
    },
  },
};

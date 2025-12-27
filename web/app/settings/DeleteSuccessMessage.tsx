export default function DeleteSuccessMessage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="text-green-600 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Профилът е изтрит
        </h2>
        <p className="text-gray-600">
          Всички ваши данни бяха успешно изтрити. Сега ще бъдете отписани...
        </p>
      </div>
    </div>
  );
}

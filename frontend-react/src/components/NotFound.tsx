import { FileQuestion } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <FileQuestion className="w-16 h-16 text-stone-300" />
      <h2 className="text-xl font-semibold text-stone-600">页面不存在</h2>
      <p className="text-sm text-stone-400">请检查输入的地址是否正确</p>
      <button onClick={() => navigate('/service-hall')}
        className="text-sm px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
        返回首页
      </button>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { Select, Button, Card, Row, Col, Slider, Image as AntImage, message, Upload } from 'antd'
import { DownloadOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { composeImage, CANVAS_WIDTH, CANVAS_HEIGHT } from './lib/composeImage'
import { charInfoMap, factionLogoMap, professionCharMap, charSkinsMap } from './data/mappings'

const { Option } = Select

// 获取所有可用的阵营列表
const factionList = Object.keys(factionLogoMap)

function App() {
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  
  // 三级选择状态
  const [selectedProfession, setSelectedProfession] = useState('')
  const [selectedChar, setSelectedChar] = useState('')
  const [selectedSkin, setSelectedSkin] = useState('')
  
  // 参数状态
  const [charScale, setCharScale] = useState(1)
  const [charPos, setCharPos] = useState(0.5)
  const [logoScale, setLogoScale] = useState(1)
  const [selectedFaction, setSelectedFaction] = useState('')
  
  // 用户上传的立绘列表和当前选中的上传图
  const [uploadedImages, setUploadedImages] = useState(() => {
    // 从 sessionStorage 恢复
    const saved = sessionStorage.getItem('arkcharart_uploaded')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedUploadedImage, setSelectedUploadedImage] = useState(null)
  
  const canvasRef = useRef(null)

  // 获取有立绘的角色列表
  const charsWithSkins = Object.keys(charSkinsMap)
  
  // 职业列表（只包含有立绘的角色所属的职业）
  const professions = Object.keys(professionCharMap)
    .filter(prof => {
      // 该职业下是否有至少一个角色有立绘
      return professionCharMap[prof].some(char => charsWithSkins.includes(char))
    })
    .sort()

  // 根据选择的职业获取角色列表（只包含有立绘的角色）
  const availableChars = selectedProfession 
    ? (professionCharMap[selectedProfession] || []).filter(char => charsWithSkins.includes(char))
    : []

  // 根据选择的角色获取皮肤列表
  const availableSkins = selectedChar && charSkinsMap[selectedChar] ? charSkinsMap[selectedChar] : []

  // 获取角色的职业
  const getCharProfession = (charName) => {
    for (const [prof, chars] of Object.entries(professionCharMap)) {
      if (chars.includes(charName)) return prof
    }
    return null
  }

  // 页面初始化：默认选择蓝毒
  useEffect(() => {
    if (isInitialized) return
    
    const defaultChar = '蓝毒'
    if (charsWithSkins.includes(defaultChar)) {
      const profession = getCharProfession(defaultChar)
      if (profession) {
        setSelectedProfession(profession)
        setSelectedChar(defaultChar)
        // 选择第一个皮肤
        const skins = charSkinsMap[defaultChar]
        if (skins && skins.length > 0) {
          setSelectedSkin(skins[0].code)
        }
      }
    }
    setIsInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized])

  // 职业变化时，默认选中该职业第一个干员的第一个皮肤
  const handleProfessionChange = (profession) => {
    setSelectedProfession(profession)
    setSelectedFaction('')
    
    if (profession) {
      const chars = professionCharMap[profession] || []
      // 找到第一个有立绘的干员
      const firstCharWithSkin = chars.find(char => charsWithSkins.includes(char))
      if (firstCharWithSkin) {
        setSelectedChar(firstCharWithSkin)
        const skins = charSkinsMap[firstCharWithSkin]
        if (skins && skins.length > 0) {
          setSelectedSkin(skins[0].code)
        } else {
          setSelectedSkin('')
        }
      } else {
        setSelectedChar('')
        setSelectedSkin('')
      }
    } else {
      setSelectedChar('')
      setSelectedSkin('')
    }
  }

  // 角色变化时，默认选中该干员的第一个皮肤
  const handleCharChange = (char) => {
    setSelectedChar(char)
    setSelectedFaction('')
    
    if (char) {
      const skins = charSkinsMap[char]
      if (skins && skins.length > 0) {
        setSelectedSkin(skins[0].code)
      } else {
        setSelectedSkin('')
      }
    } else {
      setSelectedSkin('')
    }
  }

  // 查找立绘文件
  const getArtFile = useCallback(() => {
    if (!selectedChar || !selectedSkin) return null
    const skins = charSkinsMap[selectedChar]
    if (!skins) return null
    const skin = skins.find(s => s.code === selectedSkin)
    return skin ? skin.file : null
  }, [selectedChar, selectedSkin])

  // 保存上传图片列表到 sessionStorage
  const saveUploadedImages = (images) => {
    sessionStorage.setItem('arkcharart_uploaded', JSON.stringify(images))
  }

  // 处理用户上传立绘
  const handleFileChange = ({ file }) => {
    if (!file || !file.originFileObj) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const img = new window.Image()
      img.onload = () => {
        // 添加到上传列表
        const newImage = {
          id: Date.now().toString(),
          name: file.name,
          dataUrl: dataUrl,
          width: img.width,
          height: img.height
        }
        const newList = [...uploadedImages, newImage]
        setUploadedImages(newList)
        saveUploadedImages(newList)
        setSelectedUploadedImage(newImage.id)
        // 默认选择罗德岛logo
        if (!selectedFaction) {
          setSelectedFaction('罗德岛')
        }
        message.success('立绘上传成功')
        // 触发合成（延迟确保状态更新）
        setTimeout(() => generateImage(), 100)
      }
      img.onerror = () => {
        message.error('图片加载失败')
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file.originFileObj)
  }

  // 获取当前选中的上传图片对象
  const getSelectedUploadedImageObj = () => {
    return uploadedImages.find(img => img.id === selectedUploadedImage)
  }

  // 合成图片
  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    
    // 确定立绘来源：优先使用用户上传的图片
    let charImage
    const uploadedImgObj = getSelectedUploadedImageObj()
    if (uploadedImgObj) {
      charImage = uploadedImgObj.dataUrl
    } else {
      const artFile = getArtFile()
      if (!artFile) return
      charImage = `chararts/${artFile}`
    }
    
    // 获取阵营
    let faction
    if (selectedChar && charInfoMap[selectedChar]) {
      faction = selectedFaction || charInfoMap[selectedChar].faction
    } else if (selectedFaction) {
      faction = selectedFaction
    } else {
      message.error('请选择角色或阵营')
      return
    }
    
    const logoFile = factionLogoMap[faction]
    if (!logoFile) {
      message.error(`未找到势力"${faction}"的图标`)
      return
    }

    setLoading(true)
    try {
      await composeImage(
        canvas,
        'bg.png',
        charImage,
        `logos/${logoFile}`,
        { charScale, charPos, logoScale }
      )
      // 生成图片URL用于显示
      const dataUrl = canvas.toDataURL('image/png')
      setPreviewUrl(dataUrl)
    } catch (err) {
      console.error('合成失败:', err)
      message.error('图片合成失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedChar, selectedSkin, selectedFaction, charScale, charPos, logoScale, getArtFile, selectedUploadedImage, uploadedImages])

  // 组件挂载后执行首次合成
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedChar && selectedSkin) {
        generateImage()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 当参数变化时重新合成（带防抖）
  useEffect(() => {
    if (!selectedChar || !selectedSkin) return
    const timer = setTimeout(() => {
      generateImage()
    }, 200)
    return () => clearTimeout(timer)
  }, [generateImage])

  // 下载图片
  const handleDownload = () => {
    if (!previewUrl) {
      message.warning('请先生成图片')
      return
    }
    const link = document.createElement('a')
    link.href = previewUrl
    // 确定文件名
    let filename
    const uploadedImgObj = getSelectedUploadedImageObj()
    if (uploadedImgObj) {
      filename = `自定义图片_${uploadedImgObj.name}`
    } else if (selectedChar && selectedSkin) {
      filename = `明日方舟_${selectedChar}_${selectedSkin}.png`
    } else {
      filename = '合成.png'
    }
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('下载开始')
  }

  // 重置参数
  const handleReset = () => {
    setCharScale(1)
    setCharPos(0.5)
    setLogoScale(1)
    setSelectedFaction('')
    setSelectedUploadedImage(null)
    message.success('参数已重置')
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1200, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/icon.png" alt="" style={{ width: 40, height: 40 }} />
        明日方舟立绘合成工具
      </h1>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card title="参数面板">
            {/* 用户上传立绘 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                自定义立绘
                {selectedUploadedImage && <span style={{ color: '#52c41a', fontSize: 12, marginLeft: 8 }}>已选择</span>}
              </label>
              <Row gutter={[8, 8]}>
                <Col flex="auto">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    onChange={handleFileChange}
                    customRequest={() => {}}
                  >
                    <Button icon={<UploadOutlined />} block>
                      上传立绘图
                    </Button>
                  </Upload>
                </Col>
                {selectedUploadedImage && (
                  <Col flex="90px">
                    <Button 
                      onClick={() => setSelectedUploadedImage(null)}
                      block
                    >
                      停用自选
                    </Button>
                  </Col>
                )}
              </Row>
              {uploadedImages.length > 0 && (
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="选择已上传的立绘"
                  value={selectedUploadedImage || undefined}
                  onChange={setSelectedUploadedImage}
                >
                  {uploadedImages.map(img => (
                    <Option key={img.id} value={img.id}>{img.name}</Option>
                  ))}
                </Select>
              )}
            </div>

            {/* 三级联选：职业、角色、皮肤 */}
            <div style={{ marginBottom: 24 }}>
              <Row gutter={[12, 12]}>
                <Col span={8}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>职业</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择职业"
                    value={selectedProfession || undefined}
                    onChange={handleProfessionChange}
                    loading={loading}
                  >
                    {professions.map(prof => (
                      <Option key={prof} value={prof}>{prof}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={8}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>角色</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={selectedProfession ? '选择角色' : '请先选择职业'}
                    value={selectedChar || undefined}
                    onChange={handleCharChange}
                    loading={loading}
                    disabled={!selectedProfession}
                    showSearch
                    filterOption={(input, option) =>
                      option.children.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {availableChars.map(char => (
                      <Option key={char} value={char}>{char}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={8}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>立绘</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={selectedChar ? '选择立绘' : '请先选择角色'}
                    value={selectedSkin || undefined}
                    onChange={setSelectedSkin}
                    loading={loading}
                    disabled={!selectedChar}
                  >
                    {availableSkins.map(skin => (
                      <Option key={skin.code} value={skin.code}>{skin.name}</Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>

            {/* 阵营Logo选择 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                阵营Logo {selectedFaction === '' && selectedChar && <span style={{ color: '#999', fontSize: 12 }}>(默认: {charInfoMap[selectedChar]?.faction || ''})</span>}
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择阵营Logo（默认本家）"
                value={selectedFaction || undefined}
                onChange={setSelectedFaction}
                loading={loading}
                allowClear
                disabled={!selectedChar}
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
              >
                {factionList.map(faction => (
                  <Option key={faction} value={faction}>{faction}</Option>
                ))}
              </Select>
            </div>

            {/* 立绘倍率 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                立绘图片大小: {charScale.toFixed(1)}
              </label>
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={charScale}
                onChange={setCharScale}
                disabled={!selectedSkin}
              />
            </div>

            {/* 立绘位置 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                立绘图片位置: {(charPos * 100).toFixed(0)}%
              </label>
              <Slider
                min={0.3}
                max={0.7}
                step={0.01}
                value={charPos}
                onChange={setCharPos}
                disabled={!selectedSkin}
              />
            </div>

            {/* Logo倍率 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Logo大小: {logoScale.toFixed(1)}
              </label>
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={logoScale}
                onChange={setLogoScale}
                disabled={!selectedSkin}
              />
            </div>

            {/* 操作按钮 */}
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  disabled={!selectedSkin}
                  block
                >
                  重置
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  loading={loading}
                  disabled={!previewUrl}
                  block
                >
                  下载
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="预览" loading={loading}>
            <div style={{ textAlign: 'center' }}>
              {/* 隐藏的canvas用于绘制 */}
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ display: 'none' }}
              />
              {/* 用Image显示合成结果 */}
              {previewUrl ? (
                <AntImage
                  src={previewUrl}
                  alt="合成预览"
                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #f0f0f0', cursor: 'pointer' }}
                  preview={{
                    src: previewUrl,
                    mask: '点击查看大图'
                  }}
                />
              ) : (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  选择职业、角色和立绘后显示预览
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 页脚 */}
      <footer style={{ 
        marginTop: 'auto',
        padding: '16px', 
        background: '#fafafa',
        borderTop: '1px solid #f0f0f0'
      }}>
        <Row justify="space-between" align="middle">
          <Col>
            <div style={{ fontSize: 14, color: '#8c8c8c' }}>
              © 2026 ArkCharArt
            </div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <a href="https://github.com/3plus10i/arkcharart" target="_blank" rel="noopener noreferrer">
                <img src="github-favicon.svg" alt="GitHub" style={{ width: 16, height: 16, display: 'block' }} />
              </a>
              <a href="https://blog.3plus10i.top" target="_blank" rel="noopener noreferrer">
                <img src="blog-icon.ico" alt="博客" style={{ width: 16, height: 16, display: 'block' }} />
              </a>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <a href="https://ak.hypergryph.com/" target="_blank" rel="noopener noreferrer">
                <img src="arknights-favicon.ico" alt="明日方舟" style={{ width: 16, height: 16, display: 'block' }} />
              </a>
              <a href="https://prts.wiki" target="_blank" rel="noopener noreferrer">
                <img src="prts-favicon.ico" alt="PRTS" style={{ width: 16, height: 16, display: 'block' }} />
              </a>
            </div>
          </Col>
        </Row>
      </footer>
    </div>
  )
}

export default App

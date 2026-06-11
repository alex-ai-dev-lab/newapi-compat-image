package model

import (
	"gorm.io/gorm"
)

type UserAgent struct {
	Id            int    `json:"id"`
	Name          string `json:"name" gorm:"index;not null"`
	Value         string `json:"value" gorm:"type:text;not null"`
	ModelCategory string `json:"model_category" gorm:"type:varchar(64);default:'other';index"`
	IsGlobal      bool   `json:"is_global" gorm:"default:false"`
	Enabled       bool   `json:"enabled" gorm:"default:true;index"`
	SortOrder     int    `json:"sort_order" gorm:"default:0;index"`
	Remark        string `json:"remark" gorm:"type:varchar(255)"`
	CreatedTime   int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime   int64  `json:"updated_time" gorm:"bigint"`
}

func (UserAgent) TableName() string {
	return "user_agents"
}

// Model categories
const (
	ModelCategoryOpenAI = "openai"
	ModelCategoryClaude = "claude"
	ModelCategoryGemini = "gemini"
	ModelCategoryGrok   = "grok"
	ModelCategoryOther  = "other"
)

var ValidModelCategories = []string{
	ModelCategoryOpenAI,
	ModelCategoryClaude,
	ModelCategoryGrok,
	ModelCategoryGemini,
	ModelCategoryOther,
}

func GetAllUserAgents() ([]*UserAgent, error) {
	var userAgents []*UserAgent
	err := DB.Order("model_category, sort_order, name, id").Find(&userAgents).Error
	return userAgents, err
}

func GetUserAgentById(id int) (*UserAgent, error) {
	var userAgent UserAgent
	err := DB.First(&userAgent, id).Error
	return &userAgent, err
}

func GetGlobalUserAgentByCategory(category string) (*UserAgent, error) {
	var userAgent UserAgent
	err := DB.Where("model_category = ? AND is_global = ? AND enabled = ?", category, true, true).
		Order("sort_order, id").
		First(&userAgent).Error
	if err == gorm.ErrRecordNotFound {
		// Fallback to other category
		err = DB.Where("model_category = ? AND is_global = ? AND enabled = ?", ModelCategoryOther, true, true).
			Order("sort_order, id").
			First(&userAgent).Error
	}
	return &userAgent, err
}

func (ua *UserAgent) Insert() error {
	return DB.Create(ua).Error
}

func (ua *UserAgent) Update() error {
	return DB.Save(ua).Error
}

func (ua *UserAgent) Delete() error {
	return DB.Delete(ua).Error
}

func ReplaceUserAgents(userAgents []*UserAgent) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1 = 1").Delete(&UserAgent{}).Error; err != nil {
			return err
		}
		for _, ua := range userAgents {
			ua.Id = 0
			if err := tx.Create(ua).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
